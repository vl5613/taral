;; Storage contract for purchase order contract
;; data maps and vars
(define-data-var order-id-nonce uint u10001)
(define-data-var last-vault-id uint u0)

;; Order status constants
(define-constant STATUS_PENDING u0)
(define-constant STATUS_EXPORTER_SIGNED u1)
(define-constant STATUS_IMPORTER_SIGNED u2)
(define-constant STATUS_BOTH_SIGNED u3)
(define-constant STATUS_REJECTED u4)
(define-constant STATUS_COMPLETED u5)

(define-map order {id: uint}
  {
    exporter-id: uint,
    importer-id: uint,
    hash: (buff 256),
    payment-term: (string-utf8 200), ;; 30/60/90/120 Days, 50% Deposit, balance upon bill of lading
    amount: uint,
    delivery-term: (string-utf8 10) ;; FOB CIF, CFR,
  }
)

;; Order status tracking
(define-map order-status {id: uint}
  {
    status: uint,
    exporter-signed: bool,
    importer-signed: bool,
    exporter-signed-at: uint,
    importer-signed-at: uint,
    rejection-reason: (optional (string-utf8 500)),
    created-at: uint,
    updated-at: uint
  }
)

;; Payment terms detail storage
(define-map payment-terms-detail {order-id: uint}
  {
    terms-hash: (buff 256),
    downpayment-amount: uint,
    balance-amount: uint,
    payment-duration-days: uint,
    interest-rate: uint,
    submitted-by: principal,
    approved-by-counterparty: bool,
    submitted-at: uint
  }
)

(define-map order-detail {id: uint} 
  {
    hash: (buff 256)  
  }  
)

(define-map vaults
  {vault-id: uint}
  {
    borrower: principal,
    collateral-stx: uint,
    collateral-btc: uint,
    debt: uint,
    nft-id: uint,
    last-repayment-date: uint
  }
)

;; Read only functions

;; @Desc get purchase order from ID
;; @Param order-id: order ID of type uint
(define-read-only (get-purchase-order (order-id uint))
  (map-get? order {id: order-id})
)

(define-read-only (get-vault-by-id (vault-id uint))
  (map-get? vaults {vault-id: vault-id})
)

(define-read-only (get-next-vault-id)
  (let (
    (next-id (+ (var-get last-vault-id) u1))
  )
    next-id
  )
)


;; @Desc get list of purchase orders from ID list
;; @param order-ids: 100 unique order IDs of type uint
(define-read-only (get-purchase-orders (order-ids (list 100 uint))) 
  (filter is-valid-value (map get-purchase-order order-ids))  
)

;; @Desc get purchase order detail from ID
;; @Param order-id: order ID of type uint
(define-read-only (get-purchase-order-detail (order-id uint))
  (map-get? order-detail {id: order-id})
)

;; @Desc get current order ID
(define-read-only (get-order-id-nonce)
    (var-get order-id-nonce)
)
;; public functions

;; @Desc increments the order ID by 1, used after adding an order
(define-public (increment-order-id-nonce)
    (ok (var-set order-id-nonce (+ u1 (var-get order-id-nonce))))
)

;; @Desc public function to update values in vault mapping
;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (update-vault (key-tuple {vault-id: uint}) (value-tuple {
    borrower: principal,
    collateral-stx: uint,
    collateral-btc: uint,
    debt: uint,
    nft-id: uint,
    last-repayment-date: uint
    }))
    (ok   
      (map-set vaults key-tuple value-tuple)
    )
)

;; @Desc public function to delete vault mapping
;; @param vault-id: the ID of the target vault to be deleted

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (delete-vault (vault-id uint))
    (ok (map-delete vaults {vault-id: vault-id}))
)

;; @Desc function to insert order object
;; @Param exporter-id: ID of exporter of type unit
;; @Param importer-id: ID of importer of type uint
;; @Param order-hash: Hashed data of order data
;; @Param payment-term: 30/60/90/120 Days, 50% Deposit, balance upon bill of lading of type string UTF8
;; @Param amount: amount in uint
;; @param delivery-term: Terms of delivery of type string UTF8 eg: FOB CIF, CFR

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (add-order 
    (exporter-id uint)
    (importer-id uint)
    (order-hash (buff 256))
    (payment-term (string-utf8 200))                                
    (amount uint)
    (delivery-term (string-utf8 10)))
    (ok (map-insert order 
        {id: (get-order-id-nonce)} 
        {
            exporter-id: exporter-id,
            importer-id: importer-id,
            hash: order-hash,
            payment-term: payment-term,    
            amount: amount,
            delivery-term: delivery-term
        })
    )
)

;; @Desc function to insert order detail object
;; @Param order-detail-hash: Hashed data of order details

;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (add-order-details 
    (order-detail-hash (buff 256)))
    (ok (map-insert order-detail 
        {id: (get-order-id-nonce)} 
        {hash: order-detail-hash})
    )
)

;; to filter out none from list [none none (some XXX) none]
(define-private (is-valid-value
    (value (optional
        {
            exporter-id: uint,
            importer-id: uint,
            hash: (buff 256),
            payment-term: (string-utf8 200), ;; 30/60/90/120 Days, 50% Deposit, balance upon bill of lading
            amount: uint,
            delivery-term: (string-utf8 10) ;; FOB CIF, CFR,
        })
    ))

  (is-some value)
)

;; ============================================
;; Order Status Functions
;; ============================================

;; @Desc get order status by ID
;; @Param order-id: order ID of type uint
(define-read-only (get-order-status (order-id uint))
  (map-get? order-status {id: order-id})
)

;; @Desc initialize order status when order is created
;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (init-order-status (order-id uint))
  (ok (map-insert order-status
    {id: order-id}
    {
      status: STATUS_PENDING,
      exporter-signed: false,
      importer-signed: false,
      exporter-signed-at: u0,
      importer-signed-at: u0,
      rejection-reason: none,
      created-at: block-height,
      updated-at: block-height
    }
  ))
)

;; @Desc update order status
;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (update-order-status
  (order-id uint)
  (new-status uint)
  (exp-signed bool)
  (imp-signed bool)
  (exp-signed-at uint)
  (imp-signed-at uint)
  (rejection-reason (optional (string-utf8 500))))
  (ok (map-set order-status
    {id: order-id}
    {
      status: new-status,
      exporter-signed: exp-signed,
      importer-signed: imp-signed,
      exporter-signed-at: exp-signed-at,
      importer-signed-at: imp-signed-at,
      rejection-reason: rejection-reason,
      created-at: (default-to block-height (get created-at (map-get? order-status {id: order-id}))),
      updated-at: block-height
    }
  ))
)

;; ============================================
;; Payment Terms Detail Functions
;; ============================================

;; @Desc get payment terms detail by order ID
;; @Param order-id: order ID of type uint
(define-read-only (get-payment-terms-detail (order-id uint))
  (map-get? payment-terms-detail {order-id: order-id})
)

;; @Desc add payment terms detail
;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (add-payment-terms-detail
  (order-id uint)
  (terms-hash (buff 256))
  (downpayment-amount uint)
  (balance-amount uint)
  (payment-duration-days uint)
  (interest-rate uint)
  (submitted-by principal))
  (ok (map-insert payment-terms-detail
    {order-id: order-id}
    {
      terms-hash: terms-hash,
      downpayment-amount: downpayment-amount,
      balance-amount: balance-amount,
      payment-duration-days: payment-duration-days,
      interest-rate: interest-rate,
      submitted-by: submitted-by,
      approved-by-counterparty: false,
      submitted-at: block-height
    }
  ))
)

;; @Desc approve payment terms by counterparty
;; #[allow(unchecked_params)]
;; #[allow(unchecked_data)]
(define-public (approve-payment-terms (order-id uint))
  (let (
    (current-terms (unwrap! (get-payment-terms-detail order-id) (err u404)))
  )
    (ok (map-set payment-terms-detail
      {order-id: order-id}
      (merge current-terms {approved-by-counterparty: true})
    ))
  )
)

