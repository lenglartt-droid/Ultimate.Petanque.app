import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ============================================
// Receipt Validation Edge Function
// Validates Apple App Store & Google Play receipts
// server-side to prevent IAP fraud
// ============================================

const APPLE_PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const APPLE_SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
const GOOGLE_PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

const REMOVE_ADS_PRODUCT_ID = 'com.ultimatepetanque.removeads';

// ============================================
// Apple App Store Receipt Validation
// ============================================
async function validateAppleReceipt(receiptData: string): Promise<{
  valid: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}> {
  const sharedSecret = Deno.env.get('APPLE_APP_SHARED_SECRET');
  if (!sharedSecret) {
    console.error('Apple: APPLE_APP_SHARED_SECRET not configured');
    return { valid: false, error: 'Apple validation not configured' };
  }

  const payload = {
    'receipt-data': receiptData,
    'password': sharedSecret,
    'exclude-old-transactions': true,
  };

  // Try production first, then sandbox
  let response = await fetch(APPLE_PRODUCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let result = await response.json();

  // Status 21007 means receipt is from sandbox — retry against sandbox endpoint
  if (result.status === 21007) {
    console.log('Apple: Sandbox receipt detected, retrying with sandbox URL');
    response = await fetch(APPLE_SANDBOX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    result = await response.json();
  }

  console.log('Apple verification status:', result.status);

  // Status 0 = valid receipt
  if (result.status !== 0) {
    const statusMessages: Record<number, string> = {
      21000: 'App Store could not read the JSON',
      21002: 'Receipt data is malformed',
      21003: 'Receipt could not be authenticated',
      21004: 'Shared secret mismatch',
      21005: 'Receipt server temporarily unavailable',
      21006: 'Receipt is valid but subscription has expired',
      21008: 'Receipt is from production but sent to sandbox',
      21010: 'This receipt could not be authorized',
    };
    const msg = statusMessages[result.status] || `Unknown status: ${result.status}`;
    console.error('Apple: Validation failed -', msg);
    return { valid: false, error: `Apple: ${msg}` };
  }

  // Check in_app array for our product
  const inAppPurchases = result.receipt?.in_app || [];
  const latestReceiptInfo = result.latest_receipt_info || inAppPurchases;

  // Find our remove-ads product in the receipt
  const matchingPurchase = (Array.isArray(latestReceiptInfo) ? latestReceiptInfo : [latestReceiptInfo])
    .find((item: any) => item.product_id === REMOVE_ADS_PRODUCT_ID);

  if (!matchingPurchase) {
    // Also check in_app if latest_receipt_info did not match
    const inAppMatch = inAppPurchases.find((item: any) => item.product_id === REMOVE_ADS_PRODUCT_ID);
    if (!inAppMatch) {
      console.error('Apple: Product not found in receipt');
      return { valid: false, error: 'Apple: Product not found in receipt' };
    }
    return {
      valid: true,
      productId: inAppMatch.product_id,
      transactionId: inAppMatch.transaction_id,
    };
  }

  // Check cancellation_date — if present, purchase was refunded
  if (matchingPurchase.cancellation_date) {
    console.error('Apple: Purchase was refunded');
    return { valid: false, error: 'Apple: Purchase was refunded' };
  }

  return {
    valid: true,
    productId: matchingPurchase.product_id,
    transactionId: matchingPurchase.transaction_id,
  };
}

// ============================================
// Google Play Receipt Validation
// Uses service account for OAuth2
// ============================================
async function getGoogleAccessToken(): Promise<string | null> {
  const serviceAccountJson = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
  if (!serviceAccountJson) {
    console.error('Google: GOOGLE_PLAY_SERVICE_ACCOUNT not configured');
    return null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const now = Math.floor(Date.now() / 1000);

    // Build JWT header and claim set
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    // Base64url encode
    const b64url = (obj: any) => {
      const str = btoa(JSON.stringify(obj));
      return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };

    const headerB64 = b64url(header);
    const claimB64 = b64url(claimSet);
    const signatureInput = `${headerB64}.${claimB64}`;

    // Import RSA private key and sign
    const pemContent = serviceAccount.private_key
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\n/g, '');

    const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(signatureInput)
    );

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const jwt = `${headerB64}.${claimB64}.${signatureB64}`;

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.access_token) {
      return tokenData.access_token;
    }

    console.error('Google: Token exchange failed -', JSON.stringify(tokenData));
    return null;
  } catch (e) {
    console.error('Google: Error getting access token -', e);
    return null;
  }
}

async function validateGooglePlayReceipt(
  packageName: string,
  productId: string,
  purchaseToken: string,
): Promise<{
  valid: boolean;
  transactionId?: string;
  error?: string;
}> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return { valid: false, error: 'Google Play validation not configured' };
  }

  try {
    // For non-subscription (one-time) products, use products.get
    const url = `${GOOGLE_PLAY_API_BASE}/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Google: API error -', response.status, errBody);
      return { valid: false, error: `Google: API error ${response.status}` };
    }

    const data = await response.json();
    console.log('Google: Purchase state:', data.purchaseState, 'Consumption state:', data.consumptionState);

    // purchaseState: 0 = Purchased, 1 = Canceled, 2 = Pending
    if (data.purchaseState !== 0) {
      const stateMessages: Record<number, string> = {
        1: 'Purchase was canceled',
        2: 'Purchase is pending',
      };
      const msg = stateMessages[data.purchaseState] || `Unknown state: ${data.purchaseState}`;
      console.error('Google:', msg);
      return { valid: false, error: `Google: ${msg}` };
    }

    // Check acknowledgementState: 0 = not acknowledged, 1 = acknowledged
    // Purchase is valid regardless of acknowledgement state from server perspective

    return {
      valid: true,
      transactionId: data.orderId || purchaseToken.slice(0, 32),
    };
  } catch (e) {
    console.error('Google: Validation error -', e);
    return { valid: false, error: `Google: ${(e as Error).message}` };
  }
}

// ============================================
// Main Handler
// ============================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '');
    const { data: { user }, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request
    const body = await req.json();
    const { platform, receiptData, purchaseToken, packageName, productId } = body;

    if (!platform) {
      return new Response(JSON.stringify({ error: 'Missing platform' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Validating receipt for user ${user.id}, platform: ${platform}`);

    let validationResult: { valid: boolean; productId?: string; transactionId?: string; error?: string };

    // ---- Apple ----
    if (platform === 'ios') {
      if (!receiptData) {
        return new Response(JSON.stringify({ error: 'Missing receiptData for iOS' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      validationResult = await validateAppleReceipt(receiptData);
    }
    // ---- Google Play ----
    else if (platform === 'android') {
      if (!purchaseToken || !packageName) {
        return new Response(JSON.stringify({ error: 'Missing purchaseToken or packageName for Android' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      validationResult = await validateGooglePlayReceipt(
        packageName,
        productId || REMOVE_ADS_PRODUCT_ID,
        purchaseToken,
      );
    } else {
      return new Response(JSON.stringify({ error: `Unsupported platform: ${platform}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle validation result
    if (!validationResult.valid) {
      console.error(`Receipt validation failed for user ${user.id}: ${validationResult.error}`);

      // Record the failed attempt
      await supabaseAdmin.from('purchase_receipts').insert({
        user_id: user.id,
        platform,
        product_id: productId || REMOVE_ADS_PRODUCT_ID,
        transaction_id: validationResult.transactionId || null,
        receipt_data: platform === 'ios' ? (receiptData?.slice(0, 200) + '...') : purchaseToken?.slice(0, 200),
        verified: false,
      });

      return new Response(JSON.stringify({
        valid: false,
        error: validationResult.error || 'Receipt validation failed',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---- Receipt is VALID ----
    console.log(`Receipt valid for user ${user.id}, transactionId: ${validationResult.transactionId}`);

    // Check for duplicate transaction (replay attack prevention)
    if (validationResult.transactionId) {
      const { data: existing } = await supabaseAdmin
        .from('purchase_receipts')
        .select('id, user_id')
        .eq('transaction_id', validationResult.transactionId)
        .eq('verified', true)
        .limit(1);

      if (existing && existing.length > 0) {
        // Transaction already recorded
        if (existing[0].user_id === user.id) {
          // Same user — just ensure premium is set
          await supabaseAdmin.from('user_profiles').update({ is_premium: true }).eq('id', user.id);
          return new Response(JSON.stringify({ valid: true, alreadyRecorded: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          // Different user using same transaction — fraud attempt
          console.error(`Fraud: transaction ${validationResult.transactionId} already used by user ${existing[0].user_id}, attempted by ${user.id}`);
          return new Response(JSON.stringify({
            valid: false,
            error: 'Transaction already used by another account',
          }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Record verified purchase
    await supabaseAdmin.from('purchase_receipts').insert({
      user_id: user.id,
      platform,
      product_id: validationResult.productId || productId || REMOVE_ADS_PRODUCT_ID,
      transaction_id: validationResult.transactionId || null,
      receipt_data: platform === 'ios' ? (receiptData?.slice(0, 500)) : purchaseToken?.slice(0, 500),
      verified: true,
    });

    // Grant premium
    await supabaseAdmin.from('user_profiles').update({ is_premium: true }).eq('id', user.id);

    return new Response(JSON.stringify({ valid: true, transactionId: validationResult.transactionId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('validate-receipt error:', error);
    return new Response(JSON.stringify({ error: `Internal server error: ${(error as Error).message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
