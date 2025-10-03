import { useState, useEffect } from 'react';
import { MapPin, Phone, Search, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Vendor {
  id: string;
  business_name: string;
  business_type: string;
  description: string;
  current_latitude: number;
  current_longitude: number;
  last_location_update: string;
}

export default function CustomerDashboard() {
  const { user, signOut } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [callingSent, setCallingSent] = useState<string | null>(null);

  useEffect(() => {
    getUserLocation();
    loadVendors();

    const channel = supabase
      .channel('active-vendors')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendors',
        },
        () => {
          loadVendors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = vendors.filter(
        (v) =>
          v.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          v.business_type.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredVendors(filtered);
    } else {
      setFilteredVendors(vendors);
    }
  }, [searchTerm, vendors]);

  const getUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  const loadVendors = async () => {
    const { data } = await supabase
      .from('vendors')
      .select('*')
      .eq('is_active', true)
      .not('current_latitude', 'is', null)
      .not('current_longitude', 'is', null);

    setVendors(data || []);
    setFilteredVendors(data || []);
    setLoading(false);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const callVendor = async (vendorId: string) => {
    if (!user || !userLocation) {
      alert('Harap aktifkan lokasi Anda');
      return;
    }

    const { error } = await supabase.from('customer_calls').insert({
      customer_id: user.id,
      vendor_id: vendorId,
      customer_latitude: userLocation.lat,
      customer_longitude: userLocation.lng,
      status: 'pending',
    });

    if (!error) {
      setCallingSent(vendorId);
      setTimeout(() => setCallingSent(null), 3000);
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">UMKM Terdekat</h1>
            <button
              onClick={signOut}
              className="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Keluar
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Cari UMKM atau jenis usaha..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {filteredVendors.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <p className="text-gray-500">
              {searchTerm ? 'Tidak ada UMKM yang ditemukan' : 'Belum ada UMKM yang aktif'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor) => {
              const distance = userLocation
                ? calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    vendor.current_latitude,
                    vendor.current_longitude
                  )
                : null;

              return (
                <div key={vendor.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{vendor.business_name}</h3>
                        <p className="text-sm text-blue-600 font-medium">{vendor.business_type}</p>
                      </div>
                      {distance && (
                        <div className="bg-green-50 px-3 py-1 rounded-full">
                          <p className="text-sm font-semibold text-green-700">
                            {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
                          </p>
                        </div>
                      )}
                    </div>

                    {vendor.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{vendor.description}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openInMaps(vendor.current_latitude, vendor.current_longitude)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Navigation className="h-4 w-4" />
                        Lokasi
                      </button>
                      <button
                        onClick={() => callVendor(vendor.id)}
                        disabled={callingSent === vendor.id}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        <Phone className="h-4 w-4" />
                        {callingSent === vendor.id ? 'Terkirim!' : 'Panggil'}
                      </button>
                    </div>

                    {callingSent === vendor.id && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-2">
                        <p className="text-green-700 text-xs text-center font-medium">
                          Panggilan terkirim! Penjual akan segera datang ke lokasi Anda.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {userLocation && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Lokasi Anda Aktif</p>
                <p className="text-sm text-blue-700">
                  Ketika Anda memanggil penjual, lokasi Anda akan dibagikan kepada mereka
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
