import { useState, useEffect } from 'react';
import { MapPin, Phone, DollarSign, Power, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Vendor {
  id: string;
  business_name: string;
  business_type: string;
  description: string;
  is_active: boolean;
}

interface Call {
  id: string;
  customer_id: string;
  customer_latitude: number;
  customer_longitude: number;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone: string;
  };
}

interface Subscription {
  status: string;
  end_date: string;
}

export default function VendorDashboard() {
  const { user, signOut } = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationTracking, setLocationTracking] = useState(false);

  useEffect(() => {
    loadVendorData();
    subscribeToCallNotifications();
  }, [user]);

  const loadVendorData = async () => {
    if (!user) return;

    const { data: vendorData } = await supabase
      .from('vendors')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (vendorData) {
      setVendor(vendorData);
      setLocationTracking(vendorData.is_active);

      const { data: callsData } = await supabase
        .from('customer_calls')
        .select('*, profiles:customer_id(full_name, phone)')
        .eq('vendor_id', vendorData.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setCalls(callsData || []);

      const { data: subData } = await supabase
        .from('subscriptions')
        .select('status, end_date')
        .eq('vendor_id', vendorData.id)
        .eq('status', 'active')
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(subData);
    }

    setLoading(false);
  };

  const subscribeToCallNotifications = () => {
    const channel = supabase
      .channel('vendor-calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_calls',
        },
        (payload) => {
          loadVendorData();
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Panggilan Baru!', {
              body: 'Pelanggan sedang memanggilmu',
              icon: '/icon.png'
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const toggleLocationTracking = async () => {
    if (!vendor) return;

    if (!locationTracking) {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
          await supabase
            .from('vendors')
            .update({
              is_active: true,
              current_latitude: position.coords.latitude,
              current_longitude: position.coords.longitude,
              last_location_update: new Date().toISOString(),
            })
            .eq('id', vendor.id);

          setLocationTracking(true);
          setVendor({ ...vendor, is_active: true });
          startLocationUpdates();
        });
      }
    } else {
      await supabase
        .from('vendors')
        .update({ is_active: false })
        .eq('id', vendor.id);

      setLocationTracking(false);
      setVendor({ ...vendor, is_active: false });
    }
  };

  const startLocationUpdates = () => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          if (vendor) {
            await supabase
              .from('vendors')
              .update({
                current_latitude: position.coords.latitude,
                current_longitude: position.coords.longitude,
                last_location_update: new Date().toISOString(),
              })
              .eq('id', vendor.id);
          }
        },
        null,
        { enableHighAccuracy: true, maximumAge: 30000, timeout: 27000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  };

  const acknowledgeCall = async (callId: string) => {
    await supabase
      .from('customer_calls')
      .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
      .eq('id', callId);

    setCalls(calls.filter(c => c.id !== callId));
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Memuat...</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Setup UMKM Anda</h2>
          <VendorSetupForm userId={user?.id || ''} onComplete={loadVendorData} />
        </div>
      </div>
    );
  }

  const isSubscriptionExpired = !subscription || subscription.status !== 'active';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">{vendor.business_name}</h1>
          <button
            onClick={signOut}
            className="text-gray-600 hover:text-gray-900 text-sm font-medium"
          >
            Keluar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {isSubscriptionExpired && (
          <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6">
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-orange-500 mr-2" />
              <p className="text-orange-700 font-medium">
                Langganan Anda belum aktif. Bayar Rp 5.000/bulan untuk mulai menerima pelanggan.
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Status Aktif</h2>
              <Power className={locationTracking ? 'text-green-500' : 'text-gray-400'} />
            </div>
            <p className="text-gray-600 mb-4">
              {locationTracking ? 'Lokasi Anda sedang dibagikan ke pelanggan' : 'Aktifkan untuk menerima panggilan'}
            </p>
            <button
              onClick={toggleLocationTracking}
              disabled={isSubscriptionExpired}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                locationTracking
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {locationTracking ? 'Nonaktifkan' : 'Aktifkan Lokasi'}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Langganan</h2>
              <DollarSign className="text-blue-500" />
            </div>
            <div className="space-y-2">
              <p className="text-gray-600">Biaya: Rp 5.000/bulan</p>
              <p className="text-sm text-gray-500">
                Status: <span className={subscription?.status === 'active' ? 'text-green-600' : 'text-orange-600'}>
                  {subscription?.status === 'active' ? 'Aktif' : 'Belum Aktif'}
                </span>
              </p>
              {subscription && (
                <p className="text-sm text-gray-500">
                  Berlaku hingga: {new Date(subscription.end_date).toLocaleDateString('id-ID')}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center mb-6">
            <Bell className="text-blue-500 mr-2" />
            <h2 className="text-xl font-bold text-gray-900">Panggilan Masuk</h2>
            {calls.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {calls.length}
              </span>
            )}
          </div>

          {calls.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Tidak ada panggilan masuk</p>
          ) : (
            <div className="space-y-4">
              {calls.map((call) => (
                <div key={call.id} className="border border-gray-200 rounded-lg p-4 bg-blue-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{call.profiles.full_name}</p>
                      <p className="text-sm text-gray-600">{call.profiles.phone}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(call.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                      PANGGILAN BARU
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openInMaps(call.customer_latitude, call.customer_longitude)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      <MapPin className="h-4 w-4" />
                      Lihat Lokasi
                    </button>
                    <button
                      onClick={() => acknowledgeCall(call.id)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
                    >
                      Konfirmasi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function VendorSetupForm({ userId, onComplete }: { userId: string; onComplete: () => void }) {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('vendors').insert({
      user_id: userId,
      business_name: businessName,
      business_type: businessType,
      description: description,
    });

    if (!error) {
      onComplete();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Nama Usaha</label>
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Jenis Usaha</label>
        <select
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">Pilih Jenis</option>
          <option value="Makanan">Makanan</option>
          <option value="Minuman">Minuman</option>
          <option value="Jajanan">Jajanan</option>
          <option value="Kerajinan">Kerajinan</option>
          <option value="Lainnya">Lainnya</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Deskripsi</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium disabled:opacity-50"
      >
        {loading ? 'Menyimpan...' : 'Simpan'}
      </button>
    </form>
  );
}
