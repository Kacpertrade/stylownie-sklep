module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { name, price, imageUrl } = req.body;
    
    const params = new URLSearchParams();
    
    params.append('automatic_payment_methods[enabled]', 'true');
    params.append('mode', 'payment');
    params.append('success_url', `${req.headers.origin}/?status=success`);
    params.append('cancel_url', `${req.headers.origin}/?status=canceled`);
    
    // WYMUSZENIE NUMERU TELEFONU (Potrzebne dla InPost)
    params.append('phone_number_collection[enabled]', 'true');
    
    // DODATKOWE POLE NA KOD PACZKOMATU
    params.append('custom_fields[0][key]', 'paczkomat_inpost');
    params.append('custom_fields[0][label][type]', 'custom');
    params.append('custom_fields[0][label][custom]', 'Kod Paczkomatu InPost (np. NIS01M)');
    params.append('custom_fields[0][type]', 'text');
    
    // Dane o produkcie i cenie
    params.append('line_items[0][price_data][currency]', 'pln');
    params.append('line_items[0][price_data][unit_amount]', Math.round(price * 100)); 
    params.append('line_items[0][price_data][product_data][name]', name);
    params.append('line_items[0][quantity]', '1');
    
    if (imageUrl) {
        params.append('line_items[0][price_data][product_data][images][0]', imageUrl);
    }

    try {
        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ? data.error.message : 'Błąd Stripe');
        
        return res.status(200).json({ url: data.url });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};
