;; Taral Escrow Contract
;; Manages escrow for purchase orders with shipment confirmation and fund release

(define-constant VERSION "0.1.0.beta")

;; Error codes
(define-constant ERR_UNAUTHORIZED (err u401))
(define-constant ERR_ORDER_NOT_FOUND (err u404))
(define-constant ERR_ESCROW_NOT_FOUND (err u405))
(define-constant ERR_ESCROW_EXISTS (err u406))
(define-constant ERR_INVALID_STATUS (err u407))
(define-constant ERR_NOT_FUNDED (err u408))
(define-constant ERR_NOT_SHIPPED (err u409))
(define-constant ERR_ALREADY_RELEASED (err u410))
(define-constant ERR_ALREADY_DISPUTED (err u411))
(define-constant ERR_AUTO_RELEASE_NOT_READY (err u412))
(define-constant ERR_TRANSFER_FAILED (err u413))
(define-constant ERR_EMPTY_HASH (err u414))
(define-constant ERR_STORAGE_ERROR (err u415))

;; Escrow status constants (mirror from storage)
(define-constant ESCROW_STATUS_PENDING u0)
(define-constant ESCROW_STATUS_FUNDED u1)
(define-constant ESCROW_STATUS_SHIPPED u2)
(define-constant ESCROW_STATUS_DELIVERED u3)
(define-constant ESCROW_STATUS_RELEASED u4)
(define-constant ESCROW_STATUS_DISPUTED u5)
(define-constant ESCROW_STATUS_REFUNDED u6)

;; Resolution types
(define-constant RESOLUTION_PENDING u0)
(define-constant RESOLUTION_RELEASE_TO_EXPORTER u1)
(define-constant RESOLUTION_REFUND_TO_IMPORTER u2)
(define-constant RESOLUTION_PARTIAL u3)

;; Read-only functions

(define-read-only (get-info)
  (ok {version: VERSION})
)

(define-read-only (get-escrow (order-id uint))
  (contract-call? .escrow-storage get-escrow-by-order order-id)
)

(define-read-only (get-escrow-status (order-id uint))
  (match (contract-call? .escrow-storage get-escrow-by-order order-id)
    escrow-data (ok (get status escrow-data))
    (err u404)
  )
)

(define-read-only (get-shipment-info (order-id uint))
  (match (contract-call? .escrow-storage get-escrow-id-by-order order-id)
    escrow-id (contract-call? .escrow-storage get-shipment-tracking escrow-id)
    none
  )
)

(define-read-only (can-auto-release (order-id uint))
  (match (contract-call? .escrow-storage get-escrow-id-by-order order-id)
    escrow-id (ok (contract-call? .escrow-storage is-auto-releasable escrow-id))
    (err u404)
  )
)

;; Public functions

;; @Desc Create an escrow for a purchase order
;; @Param order-id: The purchase order ID
(define-public (create-escrow (order-id uint))
  (let (
    (order (unwrap! (contract-call? .purchase-order-storage get-purchase-order order-id) ERR_ORDER_NOT_FOUND))
    (status-data (unwrap! (contract-call? .purchase-order-storage get-order-status order-id) ERR_ORDER_NOT_FOUND))
    (terms (unwrap! (contract-call? .purchase-order-storage get-payment-terms-detail order-id) ERR_ORDER_NOT_FOUND))
    (exporter-id (get exporter-id order))
    (importer-id (get importer-id order))
    (amount (get amount order))
  )
    ;; Verify order is signed by both parties
    (asserts! (and (get exporter-signed status-data) (get importer-signed status-data)) ERR_INVALID_STATUS)
    ;; Verify payment terms are approved
    (asserts! (get approved-by-counterparty terms) ERR_INVALID_STATUS)
    ;; Verify no existing escrow
    (asserts! (is-none (contract-call? .escrow-storage get-escrow-id-by-order order-id)) ERR_ESCROW_EXISTS)

    ;; Get principal addresses from IDs
    (let (
      (exporter-principal (unwrap! (contract-call? .exporter-storage get-exporter-principal-by-id exporter-id) ERR_ORDER_NOT_FOUND))
      (importer-principal (unwrap! (contract-call? .importer-storage get-importer-principal-by-id importer-id) ERR_ORDER_NOT_FOUND))
      (downpayment (get downpayment-amount terms))
      (balance (get balance-amount terms))
    )
      ;; Create the escrow
      (let (
        (escrow-id (unwrap! (contract-call? .escrow-storage create-escrow
          order-id
          exporter-principal
          importer-principal
          amount
          downpayment
          balance
        ) ERR_STORAGE_ERROR))
      )
        ;; Increment nonce
        (unwrap! (contract-call? .escrow-storage increment-escrow-id-nonce) ERR_STORAGE_ERROR)

        (print {action: "escrow-created", order-id: order-id, escrow-id: escrow-id})
        (ok escrow-id)
      )
    )
  )
)

;; @Desc Fund the escrow (importer deposits funds)
;; @Param order-id: The purchase order ID
(define-public (fund-escrow (order-id uint))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
  )
    ;; Verify caller is the importer
    (asserts! (is-eq tx-sender (get importer escrow)) ERR_UNAUTHORIZED)
    ;; Verify escrow is pending
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_PENDING) ERR_INVALID_STATUS)

    ;; Transfer funds from importer to contract
    (let (
      (total-amount (get amount escrow))
    )
      (unwrap! (contract-call? .token-susdt transfer total-amount tx-sender (as-contract tx-sender) none) ERR_TRANSFER_FAILED)

      ;; Mark escrow as funded
      (unwrap! (contract-call? .escrow-storage mark-escrow-funded escrow-id) ERR_STORAGE_ERROR)

      (print {action: "escrow-funded", order-id: order-id, escrow-id: escrow-id, amount: total-amount})
      (ok true)
    )
  )
)

;; @Desc Confirm shipment and upload tracking info
;; @Param order-id: The purchase order ID
;; @Param carrier: Shipping carrier name
;; @Param tracking-number: Tracking number
;; @Param estimated-delivery: Estimated delivery block height
;; @Param tracking-hash: Hash of tracking document
(define-public (confirm-shipment
  (order-id uint)
  (carrier (string-utf8 100))
  (tracking-number (string-utf8 100))
  (estimated-delivery uint)
  (tracking-hash (buff 256)))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
  )
    ;; Verify caller is the exporter
    (asserts! (is-eq tx-sender (get exporter escrow)) ERR_UNAUTHORIZED)
    ;; Verify escrow is funded
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_FUNDED) ERR_NOT_FUNDED)
    ;; Verify hash not empty
    (asserts! (> (len tracking-hash) u0) ERR_EMPTY_HASH)

    ;; Add shipment tracking
    (unwrap! (contract-call? .escrow-storage add-shipment-tracking
      escrow-id
      carrier
      tracking-number
      estimated-delivery
      tracking-hash
    ) ERR_STORAGE_ERROR)

    ;; Mark escrow as shipped
    (unwrap! (contract-call? .escrow-storage mark-escrow-shipped escrow-id tracking-hash) ERR_STORAGE_ERROR)

    (print {action: "shipment-confirmed", order-id: order-id, escrow-id: escrow-id, carrier: carrier})
    (ok true)
  )
)

;; @Desc Upload proof of delivery document
;; @Param order-id: The purchase order ID
;; @Param doc-type: Type of document (e.g., "bill-of-lading", "delivery-receipt")
;; @Param doc-hash: Hash of the document
(define-public (upload-delivery-proof
  (order-id uint)
  (doc-type (string-utf8 50))
  (doc-hash (buff 256)))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
  )
    ;; Verify caller is exporter or importer
    (asserts! (or (is-eq tx-sender (get exporter escrow)) (is-eq tx-sender (get importer escrow))) ERR_UNAUTHORIZED)
    ;; Verify escrow is shipped or delivered
    (asserts! (or (is-eq (get status escrow) ESCROW_STATUS_SHIPPED) (is-eq (get status escrow) ESCROW_STATUS_DELIVERED)) ERR_NOT_SHIPPED)
    ;; Verify hash not empty
    (asserts! (> (len doc-hash) u0) ERR_EMPTY_HASH)

    ;; Add delivery document
    (let (
      (doc-index (unwrap! (contract-call? .escrow-storage add-delivery-document
        escrow-id
        doc-type
        doc-hash
        tx-sender
      ) ERR_STORAGE_ERROR))
    )
      (print {action: "delivery-proof-uploaded", order-id: order-id, escrow-id: escrow-id, doc-type: doc-type, doc-index: doc-index})
      (ok doc-index)
    )
  )
)

;; @Desc Confirm delivery (importer confirms receipt of goods)
;; @Param order-id: The purchase order ID
;; @Param delivery-hash: Hash of delivery confirmation
(define-public (confirm-delivery (order-id uint) (delivery-hash (buff 256)))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
  )
    ;; Verify caller is the importer
    (asserts! (is-eq tx-sender (get importer escrow)) ERR_UNAUTHORIZED)
    ;; Verify escrow is shipped
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_SHIPPED) ERR_NOT_SHIPPED)
    ;; Verify hash not empty
    (asserts! (> (len delivery-hash) u0) ERR_EMPTY_HASH)

    ;; Mark escrow as delivered
    (unwrap! (contract-call? .escrow-storage mark-escrow-delivered escrow-id delivery-hash) ERR_STORAGE_ERROR)

    (print {action: "delivery-confirmed", order-id: order-id, escrow-id: escrow-id})
    (ok true)
  )
)

;; @Desc Release funds to exporter after delivery confirmation
;; @Param order-id: The purchase order ID
(define-public (release-funds (order-id uint))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
  )
    ;; Verify caller is the importer (who releases funds)
    (asserts! (is-eq tx-sender (get importer escrow)) ERR_UNAUTHORIZED)
    ;; Verify escrow is delivered
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_DELIVERED) ERR_INVALID_STATUS)
    ;; Verify not already released
    (asserts! (not (is-eq (get status escrow) ESCROW_STATUS_RELEASED)) ERR_ALREADY_RELEASED)

    ;; Transfer funds to exporter
    (let (
      (amount (get amount escrow))
      (exporter (get exporter escrow))
    )
      (unwrap! (as-contract (contract-call? .token-susdt transfer amount tx-sender exporter none)) ERR_TRANSFER_FAILED)

      ;; Mark escrow as released
      (unwrap! (contract-call? .escrow-storage mark-escrow-released escrow-id) ERR_STORAGE_ERROR)

      (print {action: "funds-released", order-id: order-id, escrow-id: escrow-id, amount: amount, exporter: exporter})
      (ok true)
    )
  )
)

;; @Desc Auto-release funds after timeout (anyone can call)
;; @Param order-id: The purchase order ID
(define-public (auto-release-funds (order-id uint))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
  )
    ;; Verify escrow is shipped (auto-release only after shipment)
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_SHIPPED) ERR_NOT_SHIPPED)
    ;; Verify auto-release time has passed
    (asserts! (contract-call? .escrow-storage is-auto-releasable escrow-id) ERR_AUTO_RELEASE_NOT_READY)
    ;; Verify not disputed
    (asserts! (not (is-eq (get status escrow) ESCROW_STATUS_DISPUTED)) ERR_ALREADY_DISPUTED)

    ;; Transfer funds to exporter
    (let (
      (amount (get amount escrow))
      (exporter (get exporter escrow))
    )
      (unwrap! (as-contract (contract-call? .token-susdt transfer amount tx-sender exporter none)) ERR_TRANSFER_FAILED)

      ;; Mark escrow as released
      (unwrap! (contract-call? .escrow-storage mark-escrow-released escrow-id) ERR_STORAGE_ERROR)

      (print {action: "funds-auto-released", order-id: order-id, escrow-id: escrow-id, amount: amount, exporter: exporter})
      (ok true)
    )
  )
)

;; @Desc Raise a dispute before fund release
;; @Param order-id: The purchase order ID
;; @Param reason: Dispute reason
(define-public (raise-dispute (order-id uint) (reason (string-utf8 500)))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
  )
    ;; Verify caller is exporter or importer
    (asserts! (or (is-eq tx-sender (get exporter escrow)) (is-eq tx-sender (get importer escrow))) ERR_UNAUTHORIZED)
    ;; Verify escrow is shipped (can only dispute after shipment, before release)
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_SHIPPED) ERR_INVALID_STATUS)
    ;; Verify not already disputed or released
    (asserts! (not (is-eq (get status escrow) ESCROW_STATUS_DISPUTED)) ERR_ALREADY_DISPUTED)
    (asserts! (not (is-eq (get status escrow) ESCROW_STATUS_RELEASED)) ERR_ALREADY_RELEASED)

    ;; Create dispute record
    (unwrap! (contract-call? .escrow-storage create-dispute escrow-id tx-sender reason) ERR_STORAGE_ERROR)

    ;; Mark escrow as disputed
    (unwrap! (contract-call? .escrow-storage mark-escrow-disputed escrow-id) ERR_STORAGE_ERROR)

    (print {action: "dispute-raised", order-id: order-id, escrow-id: escrow-id, raised-by: tx-sender})
    (ok true)
  )
)

;; @Desc Request refund (only in disputed state, requires resolution)
;; @Param order-id: The purchase order ID
(define-public (request-refund (order-id uint))
  (let (
    (escrow-id (unwrap! (contract-call? .escrow-storage get-escrow-id-by-order order-id) ERR_ESCROW_NOT_FOUND))
    (escrow (unwrap! (contract-call? .escrow-storage get-escrow escrow-id) ERR_ESCROW_NOT_FOUND))
    (dispute (unwrap! (contract-call? .escrow-storage get-dispute escrow-id) ERR_INVALID_STATUS))
  )
    ;; Verify caller is the importer
    (asserts! (is-eq tx-sender (get importer escrow)) ERR_UNAUTHORIZED)
    ;; Verify escrow is disputed
    (asserts! (is-eq (get status escrow) ESCROW_STATUS_DISPUTED) ERR_INVALID_STATUS)
    ;; Verify dispute resolved in favor of importer
    (asserts! (get resolved dispute) ERR_INVALID_STATUS)
    (asserts! (is-eq (get resolution-type dispute) RESOLUTION_REFUND_TO_IMPORTER) ERR_INVALID_STATUS)

    ;; Transfer funds back to importer
    (let (
      (amount (get amount escrow))
      (importer (get importer escrow))
    )
      (unwrap! (as-contract (contract-call? .token-susdt transfer amount tx-sender importer none)) ERR_TRANSFER_FAILED)

      ;; Mark escrow as refunded
      (unwrap! (contract-call? .escrow-storage mark-escrow-refunded escrow-id) ERR_STORAGE_ERROR)

      (print {action: "funds-refunded", order-id: order-id, escrow-id: escrow-id, amount: amount, importer: importer})
      (ok true)
    )
  )
)
