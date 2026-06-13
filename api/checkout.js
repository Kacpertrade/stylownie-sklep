module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    // Pobieramy id produktu przesłane ze strony głównej
    const { id, name, price, imageUrl, deliveryMethod, deliveryName, deliveryCost, pointCode } = req.body;
    
    const params = new URLSearchParams();
    
    // Sprawdzone metody płatności kompatybilne z każdą wersją konta Stripe
    params.append('payment_method_types[0]', 'blik');
    params.append('payment_method_types[1]', 'card');
    
    params.append('mode', 'payment');
    
    // Ważne: doklejamy ID produktu do linku sukcesu, żeby sklep wiedział co skasować po zapłacie
    params.append('success_url', `${req.headers.origin}/?status=success&productId=${id}`);
    params.append('cancel_url', `${req.headers.origin}/?status=canceled`);
    
    // Wymuszamy numer telefonu kontaktowego
    params.append('phone_number_collection[enabled]', 'true');
    
    // 🔥 NOWOŚĆ: Automatyczne tworzenie oficjalnej faktury PDF i natychmiastowa wysyłka mailowa do klienta
    params.append('invoice_creation[enabled]', 'true');
    
    // Zapisujemy kompletne informacje dla Ciebie w panelu Stripe (w sekcji Metadata)
    params.append('metadata[metoda_dostawy]', deliveryMethod);
    if (pointCode) {
        params.append('metadata[kod_punktu_odbioru]', pointCode.toUpperCase());
    }
    
    // POZYCJA 1: Zakupiona rzecz
    params.append('line_items[0][price_data][currency]', 'pln');
    params.append('line_items[0][price_data][unit_amount]', Math.round(price * 100)); 
    params.append('line_items[0][price_data][product_data][name]', name);
    params.append('line_items[0][quantity]', '1');
    
    if (imageUrl) {
        params.append('line_items[0][price_data][product_data][images][0]', imageUrl);
    }
    
    // POZYCJA 2: Koszt wybranej wysyłki (o ile jest większy niż 0 zł)
    if (deliveryCost > 0) {
        params.append('line_items[1][price_data][currency]', 'pln');
        params.append('line_items[1][price_data][unit_amount]', Math.round(deliveryCost * 100));
        params.append('line_items[1][price_data][product_data][name]', `Wysyłka: ${deliveryName}`);
        params.append('line_items[1][quantity]', '1');
    }
    
    // Jeśli wybrano tradycyjnego kuriera domowego - Stripe poprosi klienta o pełny adres
    if (deliveryMethod === 'KURIER') {
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
