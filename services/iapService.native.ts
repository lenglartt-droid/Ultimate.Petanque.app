// ============================================
// IAP Service - Native implementation (iOS/Android)
// Uses react-native-iap for In-App Purchases
// ============================================
import { Platform, NativeModules } from 'react-native';
import { getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';

// Product ID - must match App Store Connect / Google Play Console
const PRODUCT_ID = Platform.select({
  ios: 'com.ultimatepetanque.removeads',
  android: 'com.ultimatepetanque.removeads',
  default: 'com.ultimatepetanque.removeads',
});

let iapModule: any = null;
let moduleChecked = false;
let moduleAvailable = false;

function getIapModule(): any {
  if (moduleChecked) return iapModule;
  moduleChecked = true;
  // Check if the native module exists before requiring
  if (!NativeModules.RNIapModule && !NativeModules.RNIapIos && !NativeModules.RNIapAmazonModule) {
    iapModule = null;
    moduleAvailable = false;
    return null;
  }
  try {
    iapModule = require('react-native-iap');
    moduleAvailable = true;
  } catch {
    iapModule = null;
    moduleAvailable = false;
  }
  return iapModule;
}

export function isIapAvailable(): boolean {
  getIapModule();
  return moduleAvailable;
}

export async function initIap(): Promise<boolean> {
  const mod = getIapModule();
  if (!mod) return false;
  try {
    await mod.initConnection();
    return true;
  } catch (e) {
    console.log('IAP init error:', e);
    return false;
  }
}

export async function getRemoveAdsProduct(): Promise<{ price: string; currency: string; localizedPrice: string } | null> {
  const mod = getIapModule();
  if (!mod || !PRODUCT_ID) return null;
  try {
    const products = await mod.getProducts({ skus: [PRODUCT_ID] });
    if (products && products.length > 0) {
      const product = products[0];
      return {
        price: product.price || '5.99',
        currency: product.currency || 'EUR',
        localizedPrice: product.localizedPrice || '5,99 €',
      };
    }
    return null;
  } catch (e) {
    console.log('Error fetching IAP product:', e);
    return null;
  }
}

export async function purchaseRemoveAds(): Promise<{ success: boolean; error?: string }> {
  const mod = getIapModule();
  if (!mod || !PRODUCT_ID) {
    return { success: false, error: 'IAP not available' };
  }

  try {
    const purchase = await mod.requestPurchase({
      sku: PRODUCT_ID,
      andDangerouslyFinishTransactionAutomaticallyIOS: false,
    });

    if (!purchase) {
      return { success: false, error: 'Purchase cancelled' };
    }

    // Validate receipt server-side to prevent fraud
    const supabase = getSupabaseClient();
    const receiptPayload: any = {
      platform: Platform.OS,
      productId: PRODUCT_ID,
    };

    if (Platform.OS === 'ios') {
      // iOS: send the full receipt data for Apple verification
      receiptPayload.receiptData = purchase.transactionReceipt || null;
    } else {
      // Android: send the purchase token + package name for Google Play verification
      receiptPayload.purchaseToken = purchase.purchaseToken || null;
      receiptPayload.packageName = purchase.packageNameAndroid || 'com.ultimatepetanque.app';
    }

    const { data, error } = await supabase.functions.invoke('validate-receipt', {
      body: receiptPayload,
    });

    if (error) {
      let errorMessage = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const textContent = await error.context?.text();
          const parsed = textContent ? JSON.parse(textContent) : null;
          errorMessage = parsed?.error || textContent || error.message;
        } catch {
          errorMessage = error.message;
        }
      }
      // Log but don't block — still finish the transaction
      // The user may have paid; we record on server as unverified
      console.log('Receipt validation error:', errorMessage);

      // Fallback: record purchase without validation
      await supabase.functions.invoke('record-purchase', {
        body: {
          platform: Platform.OS,
          productId: PRODUCT_ID,
          transactionId: purchase.transactionId || purchase.purchaseToken || null,
        },
      }).catch(() => {});
    }

    // Finish the transaction
    try {
      if (Platform.OS === 'ios') {
        await mod.finishTransaction({ purchase, isConsumable: false });
      } else {
        await mod.acknowledgePurchaseAndroid({ token: purchase.purchaseToken });
      }
    } catch (finishErr) {
      console.log('Error finishing transaction:', finishErr);
    }

    return { success: true };
  } catch (e: any) {
    if (e?.code === 'E_USER_CANCELLED') {
      return { success: false, error: 'cancelled' };
    }
    console.log('Purchase error:', e);
    return { success: false, error: e?.message || 'Purchase failed' };
  }
}

export async function restorePurchases(): Promise<{ success: boolean; hasPremium: boolean; error?: string }> {
  const mod = getIapModule();
  if (!mod) return { success: false, hasPremium: false, error: 'IAP not available' };

  try {
    const purchases = await mod.getAvailablePurchases();
    const hasPremium = purchases.some((p: any) => p.productId === PRODUCT_ID);

    if (hasPremium) {
      // Re-validate restored purchase on server
      const supabase = getSupabaseClient();
      const restoredPurchase = purchases.find((p: any) => p.productId === PRODUCT_ID);
      const receiptPayload: any = {
        platform: Platform.OS,
        productId: PRODUCT_ID,
      };

      if (Platform.OS === 'ios' && restoredPurchase?.transactionReceipt) {
        receiptPayload.receiptData = restoredPurchase.transactionReceipt;
      } else if (Platform.OS === 'android' && restoredPurchase?.purchaseToken) {
        receiptPayload.purchaseToken = restoredPurchase.purchaseToken;
        receiptPayload.packageName = restoredPurchase.packageNameAndroid || 'com.ultimatepetanque.app';
      }

      // Try validate-receipt first, fallback to record-purchase
      const { error: valError } = await supabase.functions.invoke('validate-receipt', {
        body: receiptPayload,
      });

      if (valError) {
        // Fallback
        await supabase.functions.invoke('record-purchase', {
          body: {
            platform: Platform.OS,
            productId: PRODUCT_ID,
            transactionId: restoredPurchase?.transactionId || 'restored',
          },
        }).catch(() => {});
      }
    }

    return { success: true, hasPremium };
  } catch (e: any) {
    console.log('Restore purchases error:', e);
    return { success: false, hasPremium: false, error: e?.message || 'Restore failed' };
  }
}

export async function endIapConnection(): Promise<void> {
  const mod = getIapModule();
  if (!mod) return;
  try {
    await mod.endConnection();
  } catch {
    // silent
  }
}
