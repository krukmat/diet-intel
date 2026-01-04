import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';

type TranslateFn = (key: string, options?: any) => string;

export const useBarcodeFlow = (t: TranslateFn) => {
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<any>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const processBarcode = async (barcode: string) => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (barcode === '1234567890123') {
        const mockProduct = {
          code: '1234567890123',
          product_name: 'Coca Cola Classic',
          brands: 'Coca-Cola',
          serving_size: '330ml',
          nutriments: {
            energy_kcal_100g: 42,
            proteins_100g: 0,
            fat_100g: 0,
            carbohydrates_100g: 10.6,
            sugars_100g: 10.6,
            salt_100g: 0,
          },
          image_front_url:
            'https://images.openfoodfacts.org/images/products/123/456/789/0123/front_en.3.400.jpg',
        };
        setCurrentProduct(mockProduct);
        setShowProductDetail(true);
        return;
      }

      if (barcode === '7622210081551') {
        const mockProduct = {
          code: '7622210081551',
          product_name: 'Nutella',
          brands: 'Ferrero',
          serving_size: '15g',
          nutriments: {
            energy_kcal_100g: 546,
            proteins_100g: 6.3,
            fat_100g: 31,
            carbohydrates_100g: 57,
            sugars_100g: 57,
            salt_100g: 0.107,
          },
          image_front_url:
            'https://images.openfoodfacts.org/images/products/762/221/008/1551/front_en.3.400.jpg',
        };
        setCurrentProduct(mockProduct);
        setShowProductDetail(true);
        return;
      }

      Alert.alert(t('product.notFound.title'), t('product.notFound.message'), [
        { text: t('common.ok') },
      ]);
    }, 2000);
  };

  const handleBarCodeScanned = ({ data }: { type: string; data: string }) => {
    setScanned(true);
    setShowCamera(false);
    processBarcode(data);
  };

  const handleSubmit = () => {
    if (manualBarcode.trim()) {
      processBarcode(manualBarcode.trim());
    }
  };

  const resetInput = () => {
    setManualBarcode('');
    setLoading(false);
    setScanned(false);
  };

  const startCamera = () => {
    if (hasPermission === null) {
      Alert.alert(t('permissions.title'), t('permissions.requesting'));
      return;
    }
    if (hasPermission === false) {
      Alert.alert(t('permissions.noAccess.title'), t('permissions.noAccess.message'));
      return;
    }
    setShowCamera(true);
    setScanned(false);
  };

  const stopCamera = () => {
    setShowCamera(false);
  };

  const closeProductDetail = () => {
    setShowProductDetail(false);
    setCurrentProduct(null);
  };

  return {
    manualBarcode,
    setManualBarcode,
    loading,
    hasPermission,
    scanned,
    showCamera,
    currentProduct,
    showProductDetail,
    handleBarCodeScanned,
    handleSubmit,
    resetInput,
    startCamera,
    stopCamera,
    closeProductDetail,
  };
};
