;; Escrow Storage Contract
;; Stores escrow data for purchase orders with shipment confirmation

;; Escrow status constants
(define-constant ESCROW_STATUS_PENDING u0)
(define-constant ESCROW_STATUS_FUNDED u1)
(define-constant ESCROW_STATUS_SHIPPED u2)
(define-constant ESCROW_STATUS_DELIVERED u3)
(define-constant ESCROW_STATUS_RELEASED u4)
(define-constant ESCROW_STATUS_DISPUTED u5)
(define-constant ESCROW_STATUS_REFUNDED u6)

;; Auto-release period in blocks (approximately 14 days at 10 min blocks)
(define-data-var auto-release-blocks uint u2016)

;; Escrow nonce for unique IDs
(define-data-var escrow-id-nonce uint u1)

;; Main escrow storage map
(define-map escrows {id: uint}
  {
    order-id: uint,
    exporter: principal,
    importer: principal,
    amount: uint,
    downpayment-amount: uint,
    balance-amount: uint,
    status: uint,
    funded-at: uint,
    shipped-at: uint,
    delivered-at: uint,
    released-at: uint,
    auto-release-at: uint,
    shipment-hash: (optional (buff 256)),
    delivery-hash: (optional (buff 256)),
    created-at: uint,
    updated-at: uint
  }
)

;; Map order ID to escrow ID
(define-map order-escrow {order-id: uint} {escrow-id: uint})

;; Shipment tracking map
(define-map shipment-tracking {escrow-id: uint}
  {
    carrier: (string-utf8 100),
    tracking-number: (string-utf8 100),
    estimated-delivery: uint,
    shipped-at: uint,
    tracking-hash: (buff 256)
  }
)

;; Delivery documents map
(define-map delivery-documents {escrow-id: uint, doc-index: uint}
  {
    doc-type: (string-utf8 50),
    doc-hash: (buff 256),
    uploaded-by: principal,
    uploaded-at: uint,
    verified: bool
  }
)

;; Document count per escrow
(define-map escrow-doc-count {escrow-id: uint} {count: uint})

;; Dispute records
(define-map disputes {escrow-id: uint}
  {
    raised-by: principal,
    reason: (string-utf8 500),
    raised-at: uint,
    resolved: bool,
    resolution: (optional (string-utf8 500)),
    resolved-at: uint,
    resolution-type: uint  ;; 0=pending, 1=release-to-exporter, 2=refund-to-importer, 3=partial
  }
)

;; Read-only functions

(define-read-only (get-escrow-id-nonce)
  (var-get escrow-id-nonce)
)

(define-read-only (get-escrow (escrow-id uint))
  (map-get? escrows {id: escrow-id})
)

(define-read-only (get-escrow-by-order (order-id uint))
  (match (map-get? order-escrow {order-id: order-id})
    escrow-mapping (map-get? escrows {id: (get escrow-id escrow-mapping)})
    none
  )
)

(define-read-only (get-escrow-id-by-order (order-id uint))
  (match (map-get? order-escrow {order-id: order-id})
    escrow-mapping (some (get escrow-id escrow-mapping))
    none
  )
)

(define-read-only (get-shipment-tracking (escrow-id uint))
  (map-get? shipment-tracking {escrow-id: escrow-id})
)

(define-read-only (get-delivery-document (escrow-id uint) (doc-index uint))
  (map-get? delivery-documents {escrow-id: escrow-id, doc-index: doc-index})
)

(define-read-only (get-escrow-doc-count (escrow-id uint))
  (default-to {count: u0} (map-get? escrow-doc-count {escrow-id: escrow-id}))
)

(define-read-only (get-dispute (escrow-id uint))
  (map-get? disputes {escrow-id: escrow-id})
)

(define-read-only (get-auto-release-blocks)
  (var-get auto-release-blocks)
)

(define-read-only (is-auto-releasable (escrow-id uint))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (and
      (is-eq (get status escrow-data) ESCROW_STATUS_SHIPPED)
      (>= block-height (get auto-release-at escrow-data))
    )
    false
  )
)

;; Public functions

(define-public (increment-escrow-id-nonce)
  (begin
    (var-set escrow-id-nonce (+ (var-get escrow-id-nonce) u1))
    (ok true)
  )
)

(define-public (set-auto-release-blocks (blocks uint))
  (begin
    (var-set auto-release-blocks blocks)
    (ok true)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (create-escrow
  (order-id uint)
  (exporter principal)
  (importer principal)
  (amount uint)
  (downpayment-amount uint)
  (balance-amount uint))
  (let (
    (escrow-id (var-get escrow-id-nonce))
    (auto-release-at (+ block-height (var-get auto-release-blocks)))
  )
    (map-set escrows {id: escrow-id}
      {
        order-id: order-id,
        exporter: exporter,
        importer: importer,
        amount: amount,
        downpayment-amount: downpayment-amount,
        balance-amount: balance-amount,
        status: ESCROW_STATUS_PENDING,
        funded-at: u0,
        shipped-at: u0,
        delivered-at: u0,
        released-at: u0,
        auto-release-at: auto-release-at,
        shipment-hash: none,
        delivery-hash: none,
        created-at: block-height,
        updated-at: block-height
      }
    )
    (map-set order-escrow {order-id: order-id} {escrow-id: escrow-id})
    (ok escrow-id)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (update-escrow-status (escrow-id uint) (new-status uint))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (ok (map-set escrows {id: escrow-id}
      (merge escrow-data {
        status: new-status,
        updated-at: block-height
      })
    ))
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (mark-escrow-funded (escrow-id uint))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (ok (map-set escrows {id: escrow-id}
      (merge escrow-data {
        status: ESCROW_STATUS_FUNDED,
        funded-at: block-height,
        updated-at: block-height
      })
    ))
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (mark-escrow-shipped (escrow-id uint) (shipment-hash (buff 256)))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (let (
      (new-auto-release-at (+ block-height (var-get auto-release-blocks)))
    )
      (ok (map-set escrows {id: escrow-id}
        (merge escrow-data {
          status: ESCROW_STATUS_SHIPPED,
          shipped-at: block-height,
          auto-release-at: new-auto-release-at,
          shipment-hash: (some shipment-hash),
          updated-at: block-height
        })
      ))
    )
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (mark-escrow-delivered (escrow-id uint) (delivery-hash (buff 256)))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (ok (map-set escrows {id: escrow-id}
      (merge escrow-data {
        status: ESCROW_STATUS_DELIVERED,
        delivered-at: block-height,
        delivery-hash: (some delivery-hash),
        updated-at: block-height
      })
    ))
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (mark-escrow-released (escrow-id uint))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (ok (map-set escrows {id: escrow-id}
      (merge escrow-data {
        status: ESCROW_STATUS_RELEASED,
        released-at: block-height,
        updated-at: block-height
      })
    ))
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (mark-escrow-disputed (escrow-id uint))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (ok (map-set escrows {id: escrow-id}
      (merge escrow-data {
        status: ESCROW_STATUS_DISPUTED,
        updated-at: block-height
      })
    ))
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (mark-escrow-refunded (escrow-id uint))
  (match (map-get? escrows {id: escrow-id})
    escrow-data
    (ok (map-set escrows {id: escrow-id}
      (merge escrow-data {
        status: ESCROW_STATUS_REFUNDED,
        updated-at: block-height
      })
    ))
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (add-shipment-tracking
  (escrow-id uint)
  (carrier (string-utf8 100))
  (tracking-number (string-utf8 100))
  (estimated-delivery uint)
  (tracking-hash (buff 256)))
  (ok (map-set shipment-tracking {escrow-id: escrow-id}
    {
      carrier: carrier,
      tracking-number: tracking-number,
      estimated-delivery: estimated-delivery,
      shipped-at: block-height,
      tracking-hash: tracking-hash
    }
  ))
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (add-delivery-document
  (escrow-id uint)
  (doc-type (string-utf8 50))
  (doc-hash (buff 256))
  (uploaded-by principal))
  (let (
    (current-count (get count (get-escrow-doc-count escrow-id)))
    (new-index current-count)
  )
    (map-set delivery-documents {escrow-id: escrow-id, doc-index: new-index}
      {
        doc-type: doc-type,
        doc-hash: doc-hash,
        uploaded-by: uploaded-by,
        uploaded-at: block-height,
        verified: false
      }
    )
    (map-set escrow-doc-count {escrow-id: escrow-id} {count: (+ current-count u1)})
    (ok new-index)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (verify-delivery-document (escrow-id uint) (doc-index uint))
  (match (map-get? delivery-documents {escrow-id: escrow-id, doc-index: doc-index})
    doc-data
    (ok (map-set delivery-documents {escrow-id: escrow-id, doc-index: doc-index}
      (merge doc-data {verified: true})
    ))
    (err u404)
  )
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (create-dispute
  (escrow-id uint)
  (raised-by principal)
  (reason (string-utf8 500)))
  (ok (map-set disputes {escrow-id: escrow-id}
    {
      raised-by: raised-by,
      reason: reason,
      raised-at: block-height,
      resolved: false,
      resolution: none,
      resolved-at: u0,
      resolution-type: u0
    }
  ))
)

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (resolve-dispute
  (escrow-id uint)
  (resolution (string-utf8 500))
  (resolution-type uint))
  (match (map-get? disputes {escrow-id: escrow-id})
    dispute-data
    (ok (map-set disputes {escrow-id: escrow-id}
      (merge dispute-data {
        resolved: true,
        resolution: (some resolution),
        resolved-at: block-height,
        resolution-type: resolution-type
      })
    ))
    (err u404)
  )
)
