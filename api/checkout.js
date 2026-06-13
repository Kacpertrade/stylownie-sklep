module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { name, price, imageUrl, deliveryMethod, deliveryName, deliveryCost, paczkomatCode } = req.body;
    
    const params = new URLSearchParams();
    
    params.append('automatic_payment_methods[enabled]', 'true');
    params.append('mode', 'payment');
    params.append('success_url', `${req.headers.origin}/?status=success`);
    params.append('cancel_url', `${req.headers.origin}/?status=canceled`);
    
    // Wymagamy telefonu (zawsze przydatne do kontaktu)
    params.append('phone_number_collection[enabled]', 'true');
    
    // ZAPISZ METODĘ DOSTAWY I KOD PACZKOMATU W TRANSPARENTNYCH METADANYCH STRIPE
    params.append('metadata[metoda_dostawy]', deliveryMethod);
    if (paczkomatCode) {
        params.append('metadata[kod_paczkomatu]', paczkomatCode.toUpperCase());
    }
    
    // POZYCJA 1: Twój produkt (buty lub box)
    params.append('line_items[0][price_data][currency]', 'pln');
    params.append('line_items[0][price_data][unit_amount]', Math.round(price * 100)); 
    params.append('line_items[0][price_data][product_data][name]', name);
    params.append('line_items[0][quantity]', '1');
    
    if (imageUrl) {
        params.append('line_items[0][price_data][product_data][images][0]', imageUrl);
    }
    
    // POZYCJA 2: Koszt wysyłki (dodawany automatycznie, o ile jest większy niż 0)
    if (deliveryCost > 0) {
        params.append('line_items[1][price_data][currency]', 'pln');
        params.append('line_items[1][price_data][unit_amount]', Math.round(deliveryCost * 100));
        params.append('line_items[1][price_data][product_data][name]', `Dostawa: ${deliveryName}`);
        params.append('line_items[1][quantity]', '1');
    }
    
    // JEŚLI KLIENT WYBRAŁ KURIERA DPD - ZMUŚ STRIPE DO ZEBRANIA ADRESU DOMOWEGO W PL
    if (deliveryMethod === 'DPD') {
        params.append('shipping_address_collection[allowed_countries][0]', 'PL');
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
