import { useState } from 'react';
import { CreditCard, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SubscriptionManagerProps {
  vendorId: string;
  onSubscriptionCreated: () => void;
}

export default function SubscriptionManager({ vendorId, onSubscriptionCreated }: SubscriptionManagerProps) {
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const { error } = await supabase.from('subscriptions').insert({
      vendor_id: vendorId,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      amount: 5000,
      status: 'active',
      payment_date: new Date().toISOString(),
    });

    setLoading(false);

    if (!error) {
      setSuccess(true);
      setTimeout(() => {
        onSubscriptionCreated();
      }, 2000);
    }
  };

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Pembayaran Berhasil!</h3>
        <p className="text-gray-600">Langganan Anda telah aktif untuk 1 bulan ke depan</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-blue-100 text-sm">Biaya Langganan Bulanan</p>
            <p className="text-3xl font-bold">Rp 5.000</p>
          </div>
          <CreditCard className="h-12 w-12 text-blue-200" />
        </div>
        <div className="bg-blue-400 bg-opacity-30 rounded-lg p-3">
          <p className="text-sm">
            Dengan berlangganan, Anda dapat menerima panggilan dari pelanggan dan meningkatkan penjualan UMKM Anda
          </p>
        </div>
      </div>

      <form onSubmit={handlePayment} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Metode Pembayaran
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Pilih Metode Pembayaran</option>
            <option value="bank_transfer">Transfer Bank</option>
            <option value="e_wallet">E-Wallet (GoPay, OVO, Dana)</option>
            <option value="qris">QRIS</option>
          </select>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-2">Detail Pembayaran:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• Langganan: 1 bulan</li>
            <li>• Total: Rp 5.000</li>
            <li>• Berlaku hingga: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('id-ID')}</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Memproses...' : 'Bayar Sekarang'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Dengan melanjutkan, Anda menyetujui syarat dan ketentuan layanan kami
        </p>
      </form>
    </div>
  );
}
