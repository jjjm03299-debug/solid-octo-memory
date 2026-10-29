// In-memory storage for cardholders, cards, and API keys (per Nginx worker)
let cardholders = {};
let cards = {};
let apiKeys = {
    "sk_live_9f83b1a2c4d6e7f8g9h0": {
        object: "api_key",
        id: "key_default_live",
        name: "Default Master Live Key",
        key: "sk_live_9f83b1a2c4d6e7f8g9h0",
        created: Math.floor(Date.now() / 1000)
    }
};

function generateLuhnCardNumber() {
    let digits = ['4']; // Visa prefix
    for (let i = 0; i < 14; i++) {
        digits.push(Math.floor(Math.random() * 10).toString());
    }
    
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
        let val = parseInt(digits[digits.length - 1 - i], 10);
        if (i % 2 === 0) {
            val *= 2;
            if (val > 9) val -= 9;
        }
        sum += val;
    }
    let checkDigit = (10 - (sum % 10)) % 10;
    digits.push(checkDigit.toString());
    
    return digits.join('');
}

// --- API KEY MANAGEMENT ---

// POST /api/api-keys - Generate a real sk_live key
function createApiKey(r) {
    let body = {};
    try {
        body = r.requestText ? JSON.parse(r.requestText) : {};
    } catch (e) {}

    let randomHex = '9f83' + Math.random().toString(36).substr(2, 12) + Math.random().toString(36).substr(2, 4);
    let rawKey = 'sk_live_' + randomHex;
    let keyId = 'key_' + Math.random().toString(36).substr(2, 9);
    let name = body.name || "Dynamic Live Key";

    let newKeyObj = {
        object: "api_key",
        id: keyId,
        name: name,
        key: rawKey,
        created: Math.floor(Date.now() / 1000)
    };

    apiKeys[rawKey] = newKeyObj;

    r.headersOut['Content-Type'] = 'application/json';
    r.return(201, JSON.stringify(newKeyObj));
}

// GET /api/api-keys - List active api keys
function listApiKeys(r) {
    let list = Object.values(apiKeys);
    let response = {
        object: "list",
        data: list,
        has_more: false
    };

    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

// DELETE /api/api-keys/:id or key - Revoke API Key
function deleteApiKey(r) {
    let uriParts = r.uri.split('/');
    let target = uriParts[uriParts.length - 1];

    let foundKey = null;
    for (let k in apiKeys) {
        if (apiKeys[k].id === target || k === target) {
            foundKey = k;
            break;
        }
    }

    if (foundKey) {
        let deletedObj = apiKeys[foundKey];
        delete apiKeys[foundKey];
        r.headersOut['Content-Type'] = 'application/json';
        r.return(200, JSON.stringify({
            object: "api_key",
            id: deletedObj.id,
            deleted: true
        }));
    } else {
        r.headersOut['Content-Type'] = 'application/json';
        r.return(404, JSON.stringify({
            error: {
                message: "No such API key found: " + target,
                type: "invalid_request_error"
            }
        }));
    }
}

// --- CARDHOLDERS & CARDS ---

function createCardholder(r) {
    let body = {};
    try {
        body = r.requestText ? JSON.parse(r.requestText) : {};
    } catch (e) {}

    let cardholderId = 'ich_' + Math.random().toString(36).substr(2, 12);
    let name = body.name || "VirtualCardReal User";
    let email = body.email || "user@virtualcardreal.duckdns.org";

    let newCardholder = {
        object: "issuing.cardholder",
        id: cardholderId,
        name: name,
        email: email,
        status: "active",
        country: "US",
        created: Math.floor(Date.now() / 1000)
    };

    cardholders[cardholderId] = newCardholder;
    r.headersOut['Content-Type'] = 'application/json';
    r.return(201, JSON.stringify(newCardholder));
}

function listCardholders(r) {
    let list = Object.values(cardholders);
    if (list.length === 0) {
        list.push({
            object: "issuing.cardholder",
            id: "ich_default_live_us",
            name: "Default Live Cardholder",
            status: "active",
            country: "US"
        });
    }
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify({ object: "list", data: list, has_more: false }));
}

function deleteCardholder(r) {
    let uriParts = r.uri.split('/');
    let cardholderId = uriParts[uriParts.length - 1];

    if (cardholders[cardholderId]) {
        delete cardholders[cardholderId];
        r.headersOut['Content-Type'] = 'application/json';
        r.return(200, JSON.stringify({ object: "issuing.cardholder", id: cardholderId, deleted: true }));
    } else {
        r.headersOut['Content-Type'] = 'application/json';
        r.return(404, JSON.stringify({ error: { message: "No such issuing cardholder: " + cardholderId, type: "invalid_request_error" } }));
    }
}

function generateCard(r) {
    let body = {};
    try {
        body = r.requestText ? JSON.parse(r.requestText) : {};
    } catch (e) {}

    let cardholderId = body.cardholder || "ich_default_live_us";
    let now = new Date();
    let expYear = now.getFullYear() + Math.floor(Math.random() * 3) + 1;
    let expMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    let cvv = String(Math.floor(Math.random() * 900) + 100);
    let cardId = 'vc_' + Math.random().toString(36).substr(2, 12);
    let cardNumber = generateLuhnCardNumber();

    let newCard = {
        object: "issuing.card",
        id: cardId,
        cardholder: cardholderId,
        card_number: cardNumber,
        exp_month: expMonth,
        exp_year: String(expYear),
        cvv: cvv,
        country: "US",
        currency: "USD",
        status: "active",
        type: "virtual"
    };

    cards[cardId] = newCard;
    r.headersOut['Content-Type'] = 'application/json';
    r.return(201, JSON.stringify(newCard));
}

function listCards(r) {
    let list = Object.values(cards);
    if (list.length === 0) {
        list.push({
            object: "issuing.card",
            id: "vc_live_us_sample",
            cardholder: "ich_default_live_us",
            card_number: generateLuhnCardNumber(),
            exp_month: "12",
            exp_year: "2028",
            cvv: "382",
            country: "US",
            status: "active",
            type: "virtual"
        });
    }
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify({ object: "list", country: "US", data: list }));
}

function retrieveCard(r) {
    let response = {
        object: "issuing.card",
        id: "vc_live_us_retrieved",
        cardholder: "ich_default_live_us",
        card_number: generateLuhnCardNumber(),
        exp_month: "10",
        exp_year: "2029",
        cvv: "512",
        country: "US",
        status: "active",
        type: "virtual"
    };
    r.headersOut['Content-Type'] = 'application/json';
    r.return(200, JSON.stringify(response));
}

function deleteCard(r) {
    let uriParts = r.uri.split('/');
    let cardId = uriParts[uriParts.length - 1];

    if (cards[cardId]) {
        delete cards[cardId];
        r.headersOut['Content-Type'] = 'application/json';
        r.return(200, JSON.stringify({ object: "issuing.card", id: cardId, status: "canceled", deleted: true }));
    } else {
        r.headersOut['Content-Type'] = 'application/json';
        r.return(404, JSON.stringify({ error: { message: "No such card id: " + cardId, type: "invalid_request_error" } }));
    }
}

export default { 
    createApiKey, listApiKeys, deleteApiKey,
    createCardholder, listCardholders, deleteCardholder, 
    generateCard, listCards, retrieveCard, deleteCard 
};
