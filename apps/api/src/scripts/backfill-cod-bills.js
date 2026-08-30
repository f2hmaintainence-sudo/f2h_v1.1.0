const { Client } = require('/home/f2hfresh/htdocs/f2hfresh.com/apps/api/node_modules/pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://f2h_user:f2h_password@127.0.0.1:5432/f2h_fresh'
  });
  await client.connect();

  try {
    // 1. Backfill all delivered COD orders to payment_status = 'paid'
    const updOrders = await client.query(`
      UPDATE orders
      SET payment_status = 'paid', updated_at = NOW()
      WHERE status = 'delivered'
        AND (payment_mode = 'cod' OR payment_mode = 'cash')
        AND (payment_status IS NULL OR payment_status <> 'paid')
      RETURNING order_id, customer_id, total_amount
    `);
    console.log('Backfilled delivered COD orders count:', updOrders.rowCount);

    // 2. Fetch all COD orders
    const allCodOrders = await client.query(`
      SELECT o.order_id, o.customer_id, o.status, o.total_amount, o.subtotal, o.discount_amount, o.gst_amount, o.scheduled_date, o.created_at
      FROM orders o
      WHERE (o.payment_mode = 'cod' OR o.payment_mode = 'cash')
        AND o.deleted_at IS NULL
    `);

    for (const ord of allCodOrders.rows) {
      const existingBill = await client.query('SELECT bill_id FROM customer_bills WHERE reference_id = $1 LIMIT 1', [ord.order_id]);
      const isDelivered = (ord.status === 'delivered');
      const totalAmt = Number(ord.total_amount || 0);

      if (existingBill.rows.length > 0) {
        if (isDelivered) {
          await client.query(`
            UPDATE customer_bills
            SET status = 'paid', paid_amount = total_amount, due_amount = 0, updated_at = NOW()
            WHERE reference_id = $1
          `, [ord.order_id]);
        }
      } else {
        const billId = 'BILL-' + ord.order_id;
        const billStatus = isDelivered ? 'paid' : 'pending';
        const paidAmt = isDelivered ? totalAmt : 0;
        const dueAmt = isDelivered ? 0 : totalAmt;
        const billDate = ord.scheduled_date || ord.created_at;

        await client.query(`
          INSERT INTO customer_bills (
            bill_id, customer_id, bill_type, reference_id, payment_type, payment_method,
            billing_from, billing_to, due_date, subtotal, discount_amount, tax_amount,
            total_amount, paid_amount, due_amount, status, remarks, created_at, updated_at
          ) VALUES (
            $1, $2, 'order', $3, 'cod', 'cod',
            $4, $4, $4, $5, $6, $7,
            $5, $8, $9, $10, 'Cash on Delivery Order', NOW(), NOW()
          )
        `, [
          billId, ord.customer_id, ord.order_id, billDate, totalAmt,
          Number(ord.discount_amount || 0), Number(ord.gst_amount || 0),
          paidAmt, dueAmt, billStatus
        ]);

        const items = await client.query('SELECT variant_id, quantity, unit_price, total_price FROM order_items WHERE order_id = $1 AND deleted_at IS NULL', [ord.order_id]);
        for (const it of items.rows) {
          const itemTot = Number(it.total_price || (Number(it.unit_price || 0) * Number(it.quantity || 1)));
          await client.query(`
            INSERT INTO customer_bill_items (
              bill_id, reference_type, reference_id, product_variant_id,
              quantity, unit_price, discount_amount, tax_amount, total_amount, created_at
            ) VALUES ($1, 'order', $2, $3, $4, $5, 0, 0, $6, NOW())
          `, [billId, ord.order_id, it.variant_id, it.quantity, it.unit_price, itemTot]);
        }
        console.log('Created customer_bills and items for COD order:', ord.order_id);
      }

      // 3. For delivered COD orders, ensure payment_transactions record exists
      if (isDelivered) {
        const exTxn = await client.query("SELECT 1 FROM payment_transactions WHERE reference_id = $1 AND purpose = 'order_payment' AND status = 'success'", [ord.order_id]);
        if (exTxn.rows.length === 0) {
          const txnId = 'TXN_COD_' + ord.order_id + '_' + Date.now();
          await client.query(`
            INSERT INTO payment_transactions (
              transaction_id, customer_id, purpose, reference_id,
              provider, method, amount, currency, status, paid_at, created_at, updated_at
            ) VALUES ($1, $2, 'order_payment', $3, 'cash', 'cash', $4, 'INR', 'success', NOW(), NOW(), NOW())
          `, [txnId, ord.customer_id, ord.order_id, totalAmt]);
          console.log('Created payment_transactions for delivered COD order:', ord.order_id);
        }
      }
    }

    console.log('COD backfill completed successfully.');
  } catch (err) {
    console.error('Error during backfill:', err);
  } finally {
    await client.end();
  }
}

run();
