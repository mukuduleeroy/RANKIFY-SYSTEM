/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Bus, 
  PlusCircle, 
  LogOut, 
  Users, 
  History,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Search,
  Trash2,
  Maximize2,
  Camera,
  X,
  TrendingUp,
  DollarSign,
  Clock,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

type Role = 'Marshal' | 'Admin' | 'Public' | 'Owner' | null;
type View = 'landing' | 'login' | 'dashboard' | 'public';

interface Route {
  id: number;
  name: string;
  base_fee: number;
}

interface Message {
  id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  type: string;
  timestamp: string;
}

interface User {
  id: number;
  email: string;
  role: Role;
  name: string;
}

interface Vehicle {
  plate_number: string;
  driver_name: string;
  phone_number: string;
  capacity: number;
}

interface QueueEntry {
  id: number;
  vehicle_id: string;
  check_in_time: string;
  status: string;
  driver_name: string;
  capacity: number;
}

interface TripLog {
  id: number;
  vehicle_id: string;
  departure_time: string;
  marshal_id: string;
  fee_paid: boolean;
  driver_name: string;
}

interface AdminStats {
  total_trips: number;
  revenue: number;
  active_marshals: number;
  peak_hours: { hour: string; count: number }[];
  route_stats: { route_name: string; trip_count: number }[];
}

export default function App() {
  const [view, setView] = useState<View>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tripLogs, setTripLogs] = useState<TripLog[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminTab, setAdminTab] = useState<'stats' | 'vehicles' | 'routes' | 'users'>('stats');
  const [lastMessageId, setLastMessageId] = useState<number>(0);
  const [notification, setNotification] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedVehicle, setScannedVehicle] = useState<Vehicle | null>(null);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Form states
  const [checkInPlate, setCheckInPlate] = useState('');
  const [newVehicle, setNewVehicle] = useState({
    plate_number: '',
    driver_name: '',
    phone_number: '',
    capacity: 15,
    route_id: ''
  });
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (role) {
      fetchData();
      const interval = setInterval(fetchData, 5000); // Poll every 5s
      return () => clearInterval(interval);
    }
  }, [role]);

  const fetchData = async () => {
    try {
      const queryParams = role === 'Owner' ? `?owner_id=${user?.id}` : '';
      const [qRes, vRes, tRes, sRes, rRes, mRes, uRes] = await Promise.all([
        fetch('/api/queue'),
        fetch(`/api/vehicles${queryParams}`),
        fetch(`/api/trip-logs${queryParams}`),
        fetch('/api/stats/admin'),
        fetch('/api/routes'),
        fetch('/api/messages'),
        role === 'Admin' ? fetch('/api/users') : Promise.resolve({ json: () => [] })
      ]);
      setQueue(await qRes.json());
      setVehicles(await vRes.json());
      setTripLogs(await tRes.json());
      setAdminStats(await sRes.json());
      setRoutes(await rRes.json());
      const msgs = await mRes.json();
      setMessages(msgs);
      
      if (role === 'Admin') setUsers(await uRes.json());

      // Notification logic
      if (msgs.length > 0 && lastMessageId !== 0 && msgs[0].id > lastMessageId) {
        setNotification(msgs[0]);
        setTimeout(() => setNotification(null), 5000);
      }
      if (msgs.length > 0) setLastMessageId(msgs[0].id);
    } catch (err) {
      console.error("Failed to fetch data", err);
    }
  };

  const showMessage = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCheckIn = async (plate: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/queue/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plate_number: plate.toUpperCase() })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Vehicle checked in successfully!", 'success');
        setCheckInPlate('');
        setScannedVehicle(null);
        fetchData();
      } else {
        showMessage(data.error || "Check-in failed", 'error');
      }
    } catch (err) {
      showMessage("Network error", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setRole(data.role);
        setView('dashboard');
        showMessage(`Welcome back, ${data.name}`, 'success');
      } else {
        showMessage(data.error || "Login failed", 'error');
      }
    } catch (err) {
      showMessage("Network error", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async (queueId: number) => {
    setIsDispatching(true);
    setLoading(true);
    try {
      const res = await fetch('/api/queue/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          queue_id: queueId, 
          marshal_id: user?.name || 'MARSHAL_01',
          fee_paid: true 
        })
      });
      if (res.ok) {
        // Wait for animation
        setTimeout(() => {
          showMessage("Vehicle dispatched!", 'success');
          fetchData();
          setIsDispatching(false);
        }, 800);
      } else {
        showMessage("Dispatch failed", 'error');
        setIsDispatching(false);
      }
    } catch (err) {
      showMessage("Network error", 'error');
      setIsDispatching(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (type: string = 'Internal') => {
    if (!newMessage.trim()) return;
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: user?.id,
          content: newMessage,
          type
        })
      });
      setNewMessage('');
      fetchData();
      showMessage(`${type} notification sent!`, 'success');
    } catch (err) {
      showMessage("Failed to send message", 'error');
    }
  };
  const handleRegisterVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newVehicle,
          plate_number: newVehicle.plate_number.toUpperCase()
        })
      });
      const data = await res.json();
      if (res.ok) {
        showMessage("Vehicle registered!", 'success');
        setNewVehicle({ plate_number: '', driver_name: '', phone_number: '', capacity: 15, route_id: '' });
        fetchData();
      } else {
        showMessage(data.error || "Registration failed", 'error');
      }
    } catch (err) {
      showMessage("Network error", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVehicle = async (plate: string) => {
    if (!confirm(`Are you sure you want to remove vehicle ${plate}?`)) return;
    try {
      await fetch(`/api/vehicles/${plate}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      showMessage("Failed to delete", 'error');
    }
  };

  const handleAddRoute = async (name: string, fee: number) => {
    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, base_fee: fee })
      });
      if (res.ok) {
        showMessage("Route added!", 'success');
        fetchData();
      }
    } catch (err) {
      showMessage("Failed to add route", 'error');
    }
  };

  const handleDeleteRoute = async (id: number) => {
    if (!confirm("Delete this route?")) return;
    try {
      await fetch(`/api/routes/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      showMessage("Failed to delete route", 'error');
    }
  };

  const handleAddUser = async (userData: any) => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      if (res.ok) {
        showMessage("User added!", 'success');
        fetchData();
      }
    } catch (err) {
      showMessage("Failed to add user", 'error');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await fetch(`/api/users/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      showMessage("Failed to delete user", 'error');
    }
  };

  // QR Scanner Component
  const ScannerModal = () => {
    useEffect(() => {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
      }, false);

      scanner.render((decodedText) => {
        // Find vehicle in registry
        const vehicle = vehicles.find(v => v.plate_number === decodedText.toUpperCase());
        if (vehicle) {
          setScannedVehicle(vehicle);
          scanner.clear();
          setShowScanner(false);
        } else {
          showMessage("Vehicle not found in registry", 'error');
        }
      }, (error) => {
        // Silent error for scanning
      });

      return () => {
        scanner.clear();
      };
    }, []);

    return (
      <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4">
        <button 
          onClick={() => setShowScanner(false)}
          className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full"
        >
          <X size={32} />
        </button>
        <div className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-4 bg-black text-white text-center font-bold uppercase tracking-widest text-sm">
            Scan Vehicle QR
          </div>
          <div id="reader" className="w-full"></div>
          <div className="p-6 text-center text-stone-500 text-sm">
            Align the vehicle's QR code within the square to check-in.
          </div>
        </div>
      </div>
    );
  };

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex flex-col font-sans overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
          {/* Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-black/5 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl"></div>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center z-10"
          >
            <div className="w-24 h-24 bg-black rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
              <Bus className="text-white w-12 h-12" />
            </div>
            <h1 className="text-7xl font-black tracking-tighter text-black mb-4">Rankify</h1>
            <p className="text-2xl text-stone-600 font-serif italic mb-12">The Future of Commuter Logistics</p>
            
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <button 
                onClick={() => setView('login')}
                className="px-12 py-5 bg-black text-white rounded-2xl font-bold text-xl hover:bg-stone-800 transition-all shadow-xl active:scale-95"
              >
                Enter Command Center
              </button>
              <button 
                onClick={() => { setRole('Public'); setView('public'); }}
                className="px-12 py-5 bg-white text-black border-2 border-black rounded-2xl font-bold text-xl hover:bg-stone-50 transition-all shadow-xl active:scale-95"
              >
                Public Live Board
              </button>
            </div>
          </motion.div>

          <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-12 max-w-5xl w-full">
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4">
                <TrendingUp size={24} />
              </div>
              <h3 className="font-bold mb-2">FIFO Precision</h3>
              <p className="text-stone-500 text-sm">Eliminate queue disputes with automated arrival tracking.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4">
                <Camera size={24} />
              </div>
              <h3 className="font-bold mb-2">QR Integration</h3>
              <p className="text-stone-500 text-sm">Instant vehicle identification via high-speed scanner.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mx-auto mb-4">
                <DollarSign size={24} />
              </div>
              <h3 className="font-bold mb-2">Revenue Audit</h3>
              <p className="text-stone-500 text-sm">Transparent financial oversight for the association.</p>
            </div>
          </div>
        </div>
        
        <footer className="p-8 text-center text-[10px] text-stone-400 uppercase tracking-[0.2em]">
          Lifestyle Association • Rankify v2.0 • 2026
        </footer>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-stone-200"
        >
          <button onClick={() => setView('landing')} className="mb-8 text-stone-400 hover:text-black transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
            <X size={16} /> Back
          </button>
          
          <div className="mb-10">
            <h2 className="text-4xl font-black tracking-tight mb-2">Login</h2>
            <p className="text-stone-500">Access your Rankify account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-stone-400 mb-2 tracking-widest">Email Address</label>
              <input 
                type="email" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-black transition-all"
                placeholder="marshal@rankify.com"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-stone-400 mb-2 tracking-widest">Password</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl outline-none focus:ring-2 focus:ring-black transition-all"
                placeholder="••••••••"
                required
              />
            </div>
            <button 
              disabled={loading}
              className="w-full py-5 bg-black text-white rounded-2xl font-black text-lg hover:bg-stone-800 transition-all shadow-xl disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
          
          <div className="mt-10 p-4 bg-stone-50 rounded-2xl border border-stone-100">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 text-center">Demo Credentials</p>
            <div className="flex justify-between text-xs">
              <span className="text-stone-500">Admin: admin@rankify.com / admin123</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-stone-500">Marshal: marshal@rankify.com / marshal123</span>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span className="text-stone-500">Owner: owner@rankify.com / owner123</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (role === 'Public') {
    return (
      <div className="min-h-screen bg-black text-[#00FF00] font-mono p-4 md:p-12 flex flex-col">
        <div className="flex items-center justify-between mb-12 border-b border-[#00FF00]/20 pb-8">
          <div>
            <h1 className="text-5xl font-bold tracking-tighter mb-2">LIFESTYLE RANK</h1>
            <p className="text-xl opacity-70">LIVE DEPARTURE BOARD</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            <p className="text-sm opacity-50 uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 text-xs font-bold uppercase tracking-widest opacity-50 mb-4 px-4">
          <div className="col-span-2">POS</div>
          <div className="col-span-6">PLATE NUMBER</div>
          <div className="col-span-4 text-right">STATUS</div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {queue.length === 0 ? (
            <div className="text-center py-20 text-2xl opacity-30">NO VEHICLES IN QUEUE</div>
          ) : (
            queue.map((item, index) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`grid grid-cols-12 gap-4 p-6 rounded border ${index === 0 ? 'bg-[#00FF00]/10 border-[#00FF00] text-3xl font-bold' : 'border-[#00FF00]/20 text-2xl'}`}
              >
                <div className="col-span-2">{index + 1}</div>
                <div className="col-span-6">{item.vehicle_id}</div>
                <div className="col-span-4 text-right">
                  {index === 0 ? 'LOADING' : 'WAITING'}
                </div>
              </motion.div>
            ))
          )}
        </div>

        <div className="mt-12 flex items-center justify-between text-sm border-t border-[#00FF00]/20 pt-8">
          <p>SYSTEM STATUS: OPERATIONAL</p>
          <button onClick={() => setRole(null)} className="hover:underline">EXIT VIEW</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] font-sans text-stone-900">
      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bus className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight">Rankify</span>
            <span className="ml-2 px-2 py-0.5 bg-stone-100 text-[10px] font-bold uppercase rounded border border-stone-200">
              {role}
            </span>
          </div>
          <button 
            onClick={() => { setRole(null); setView('landing'); }}
            className="flex items-center gap-2 text-stone-500 hover:text-black transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {/* Real-time Notifications */}
        <AnimatePresence>
          {notification && (
            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="fixed top-20 right-4 z-[60] w-80 p-4 bg-black text-white rounded-2xl shadow-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-2 h-2 rounded-full ${notification.type === 'SMS' ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{notification.type} NOTIFICATION</span>
              </div>
              <p className="text-sm font-bold mb-1">{notification.sender_name}</p>
              <p className="text-xs opacity-70">{notification.content}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notifications */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-3"
            >
              <AlertCircle size={20} />
              {error}
            </motion.div>
          )}
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-3"
            >
              <CheckCircle2 size={20} />
              {success}
            </motion.div>
          )}
        </AnimatePresence>

        {role === 'Marshal' ? (
          <div className="space-y-8">
            {/* Top Section: Current Loading & Rank Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl shadow-xl border-4 border-emerald-500 overflow-hidden h-full">
                  <div className="bg-emerald-500 p-4 text-white font-bold uppercase tracking-widest text-center">
                    Current Loading (Position 1)
                  </div>
                  {queue.length > 0 ? (
                    <div className="p-8 flex flex-col md:flex-row items-center justify-between gap-8 relative h-full min-h-[200px]">
                      <AnimatePresence>
                        {isDispatching && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1.2 }}
                            exit={{ opacity: 0, x: 100 }}
                            className="absolute inset-0 bg-emerald-500/10 z-10 flex items-center justify-center rounded-2xl pointer-events-none"
                          >
                            <motion.div 
                              animate={{ x: [0, 500], opacity: [1, 0] }}
                              transition={{ duration: 0.8, ease: "easeIn" }}
                            >
                              <Bus className="text-emerald-600 w-24 h-24" />
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      
                      <div className="text-center md:text-left">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Plate Number</p>
                        <h2 className="text-7xl font-black tracking-tighter mb-2">{queue[0].vehicle_id}</h2>
                        <div className="flex items-center gap-4 text-stone-500">
                          <p className="flex items-center gap-1"><Users size={16}/> {queue[0].capacity} Seats</p>
                          <p className="flex items-center gap-1"><Clock size={16}/> {new Date(queue[0].check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDispatch(queue[0].id)}
                        disabled={loading || isDispatching}
                        className="w-full md:w-auto px-12 py-8 bg-emerald-600 text-white rounded-2xl font-black text-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 active:scale-95 flex items-center justify-center gap-4 relative overflow-hidden"
                      >
                        {isDispatching ? 'DISPATCHING...' : 'DISPATCH'}
                        <ArrowRight size={32} />
                      </button>
                    </div>
                  ) : (
                    <div className="p-20 text-center text-stone-300 italic text-xl">
                      Queue is empty. Ready for arrivals.
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Arrival Stats */}
              <div className="lg:col-span-1">
                <div className="h-full bg-stone-900 rounded-3xl p-8 text-white flex flex-col justify-between">
                  <div>
                    <h3 className="text-stone-400 font-bold uppercase tracking-widest text-xs mb-8">Rank Status</h3>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Waiting</span>
                        <span className="text-3xl font-bold">{Math.max(0, queue.length - 1)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500">Total Today</span>
                        <span className="text-3xl font-bold">{adminStats?.total_trips || 0}</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowScanner(true)}
                    className="mt-8 w-full py-6 bg-white text-black rounded-2xl font-black text-xl flex items-center justify-center gap-3 hover:bg-stone-200 transition-all active:scale-95"
                  >
                    <Camera size={24} />
                    QUICK SCAN
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Section: Next Up & Dedicated Notification Center */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden h-full">
                  <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <TrendingUp className="text-stone-400" />
                      Next Up (FIFO Sequence)
                    </h2>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                      Traffic Light Priority
                    </span>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {queue.slice(1, 6).length === 0 ? (
                      <div className="p-12 text-center text-stone-400 italic">
                        No vehicles waiting in line
                      </div>
                    ) : (
                      queue.slice(1, 6).map((item, index) => {
                        const isYellow = index === 0;
                        return (
                          <div key={item.id} className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${isYellow ? 'bg-amber-400 text-amber-900' : 'bg-red-100 text-red-600'}`}>
                                {index + 2}
                              </div>
                              <div>
                                <h4 className="text-2xl font-bold font-mono">{item.vehicle_id}</h4>
                                <p className="text-sm text-stone-500">{item.driver_name} • {item.capacity} Seater</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-[10px] font-bold uppercase tracking-widest ${isYellow ? 'text-amber-600' : 'text-red-400'}`}>
                                {isYellow ? 'READY TO LOAD' : 'STATIONARY'}
                              </p>
                              <p className="text-sm font-medium">{Math.floor((Date.now() - new Date(item.check_in_time).getTime()) / 60000)} mins</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-1">
                <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden flex flex-col h-full min-h-[400px]">
                  <div className="p-6 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-stone-500 flex items-center gap-2">
                      <Monitor size={16} /> Marshal Feed
                    </h2>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Live</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/30">
                    {messages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-stone-300 italic text-sm">
                        <Monitor size={32} className="mb-2 opacity-20" />
                        No recent activity
                      </div>
                    ) : (
                      messages.map(m => (
                        <motion.div 
                          key={m.id} 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="p-3 bg-white rounded-2xl border border-stone-100 shadow-sm"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">{m.sender_name}</span>
                            <span className="text-[9px] text-stone-300">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-xs text-stone-700 leading-relaxed">{m.content}</p>
                          <div className="mt-2 flex justify-end">
                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${m.type === 'SMS' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                              {m.type}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  <div className="p-4 border-t border-stone-100 bg-white">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type message..."
                        className="flex-1 p-3 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-black text-xs"
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage('Internal')}
                      />
                      <button 
                        onClick={() => handleSendMessage('Internal')}
                        className="p-3 bg-black text-white rounded-xl hover:bg-stone-800 transition-all"
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button 
                        onClick={() => handleSendMessage('SMS')}
                        className="flex-1 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold uppercase hover:bg-emerald-100 transition-all"
                      >
                        Send as SMS
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Section: Manual Entry (Backup) */}
            <div className="bg-stone-100 p-8 rounded-3xl border border-stone-200">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-lg font-bold">Manual Check-In</h3>
                  <p className="text-stone-500 text-sm">Use this if the QR scanner is unavailable.</p>
                </div>
                <div className="flex w-full md:w-auto gap-2">
                  <input 
                    type="text" 
                    value={checkInPlate}
                    onChange={(e) => setCheckInPlate(e.target.value)}
                    placeholder="PLATE NUMBER"
                    className="flex-1 md:w-64 p-4 bg-white border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-black uppercase font-mono font-bold"
                  />
                  <button 
                    onClick={() => handleCheckIn(checkInPlate)}
                    className="px-8 py-4 bg-black text-white rounded-xl font-bold hover:bg-stone-800 transition-all"
                  >
                    ADD
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : role === 'Owner' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">My Fleet</h3>
                <div className="space-y-4">
                  {vehicles.map(v => (
                    <div key={v.plate_number} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                      <div>
                        <p className="font-mono font-bold text-lg">{v.plate_number}</p>
                        <p className="text-xs text-stone-500">{v.driver_name} • {v.route_name || 'No Route'}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${queue.find(q => q.vehicle_id === v.plate_number) ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600'}`}>
                        {queue.find(q => q.vehicle_id === v.plate_number) ? 'In Queue' : 'Offline'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Revenue Summary</h3>
                <div className="text-center py-8">
                  <p className="text-5xl font-black mb-2">${tripLogs.length * 10}</p>
                  <p className="text-stone-500 text-sm">Total Earnings from {tripLogs.length} Trips</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="p-8 border-b border-stone-100">
                <h2 className="text-xl font-bold">My Trip History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-stone-50 text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                      <th className="p-6">Vehicle</th>
                      <th className="p-6">Time</th>
                      <th className="p-6">Route</th>
                      <th className="p-6">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {tripLogs.map(log => (
                      <tr key={log.id}>
                        <td className="p-6 font-mono font-bold">{log.vehicle_id}</td>
                        <td className="p-6 text-sm">{new Date(log.departure_time).toLocaleString()}</td>
                        <td className="p-6 text-sm">{log.route_name}</td>
                        <td className="p-6">
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">$10.00</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Admin Tabs */}
            <div className="flex gap-4 border-b border-stone-200 mb-8">
              {['stats', 'vehicles', 'routes', 'users'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab as any)}
                  className={`pb-4 px-2 text-sm font-bold uppercase tracking-widest transition-all relative ${adminTab === tab ? 'text-black' : 'text-stone-400 hover:text-stone-600'}`}
                >
                  {tab}
                  {adminTab === tab && (
                    <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-black" />
                  )}
                </button>
              ))}
            </div>

            {adminTab === 'stats' && (
              <>
                {/* Admin KPI Widgets */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
                      <TrendingUp className="text-stone-600" size={24} />
                    </div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total Trips Today</p>
                    <p className="text-5xl font-black">{adminStats?.total_trips || 0}</p>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
                    <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                      <DollarSign className="text-emerald-600" size={24} />
                    </div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Revenue Collected</p>
                    <p className="text-5xl font-black">${adminStats?.revenue || 0}</p>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
                      <Users className="text-stone-600" size={24} />
                    </div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Active Marshals</p>
                    <p className="text-5xl font-black">{adminStats?.active_marshals || 1}</p>
                  </div>
                </div>

                {/* Visual Reports: Peak Hours & Route Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
                    <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
                      <Clock className="text-stone-400" />
                      Peak Hour Activity
                    </h2>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={adminStats?.peak_hours || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A8A29E' }} tickFormatter={(h) => `${h}:00`} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A8A29E' }} />
                          <Tooltip cursor={{ fill: '#f5f5f5' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {(adminStats?.peak_hours || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.count > 5 ? '#10B981' : '#000000'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
                    <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
                      <Bus className="text-stone-400" />
                      Route Popularity (Today)
                    </h2>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={adminStats?.route_stats || []} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#A8A29E' }} />
                          <YAxis type="category" dataKey="route_name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#A8A29E' }} width={100} />
                          <Tooltip cursor={{ fill: '#f5f5f5' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                          <Bar dataKey="trip_count" fill="#000000" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Audit Trail */}
                <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                  <div className="p-8 border-b border-stone-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <History className="text-stone-400" />
                      Audit Trail (Departures)
                    </h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Filter by plate..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-black"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-50 text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                          <th className="p-6">Vehicle</th>
                          <th className="p-6">Driver</th>
                          <th className="p-6">Departure Time</th>
                          <th className="p-6">Marshal</th>
                          <th className="p-6">Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {tripLogs
                          .filter(log => log.vehicle_id.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(log => (
                            <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                              <td className="p-6 font-mono font-bold text-lg">{log.vehicle_id}</td>
                              <td className="p-6 text-sm font-medium">{log.driver_name}</td>
                              <td className="p-6 text-sm text-stone-500">
                                {new Date(log.departure_time).toLocaleString()}
                              </td>
                              <td className="p-6 text-xs font-bold text-stone-400 uppercase">{log.marshal_id}</td>
                              <td className="p-6">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                                  $10.00 Paid
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {adminTab === 'vehicles' && (
              <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold">Vehicle Registry</h2>
                  <button onClick={() => showMessage("Use the Marshal dashboard to add vehicles for now", "error")} className="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold">ADD VEHICLE</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                        <th className="p-6">Plate</th>
                        <th className="p-6">Driver</th>
                        <th className="p-6">Route</th>
                        <th className="p-6">Capacity</th>
                        <th className="p-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {vehicles.map(v => (
                        <tr key={v.plate_number}>
                          <td className="p-6 font-mono font-bold">{v.plate_number}</td>
                          <td className="p-6 text-sm">{v.driver_name}</td>
                          <td className="p-6 text-sm">{v.route_name || 'Unassigned'}</td>
                          <td className="p-6 text-sm">{v.capacity} Seats</td>
                          <td className="p-6">
                            <button onClick={() => handleDeleteVehicle(v.plate_number)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminTab === 'routes' && (
              <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold">Route Management</h2>
                  <button onClick={() => {
                    const name = prompt("Route Name:");
                    const fee = prompt("Base Fee:");
                    if (name && fee) handleAddRoute(name, parseFloat(fee));
                  }} className="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold">ADD ROUTE</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                        <th className="p-6">Route Name</th>
                        <th className="p-6">Base Fee</th>
                        <th className="p-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {routes.map(r => (
                        <tr key={r.id}>
                          <td className="p-6 font-bold">{r.name}</td>
                          <td className="p-6 text-sm">${r.base_fee.toFixed(2)}</td>
                          <td className="p-6">
                            <button onClick={() => handleDeleteRoute(r.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {adminTab === 'users' && (
              <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
                <div className="p-8 border-b border-stone-100 flex justify-between items-center">
                  <h2 className="text-xl font-bold">User Management</h2>
                  <button onClick={() => {
                    const name = prompt("Name:");
                    const email = prompt("Email:");
                    const password = prompt("Password:");
                    const role = prompt("Role (Admin/Marshal/Owner):");
                    if (name && email && password && role) handleAddUser({ name, email, password, role });
                  }} className="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold">ADD USER</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-stone-50 text-[10px] uppercase font-bold text-stone-400 tracking-widest">
                        <th className="p-6">Name</th>
                        <th className="p-6">Email</th>
                        <th className="p-6">Role</th>
                        <th className="p-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {users.map(u => (
                        <tr key={u.id}>
                          <td className="p-6 font-bold">{u.name}</td>
                          <td className="p-6 text-sm">{u.email}</td>
                          <td className="p-6 text-sm">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${u.role === 'Admin' ? 'bg-purple-100 text-purple-700' : u.role === 'Marshal' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-700'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-6">
                            <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* QR Scanner Modal */}
      {showScanner && <ScannerModal />}

      {/* Scanned Vehicle Confirmation Pop-up */}
      <AnimatePresence>
        {scannedVehicle && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-stone-200"
            >
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-2xl font-black text-center mb-2">Vehicle Identified</h3>
              <p className="text-stone-500 text-center mb-8">Confirm check-in for this vehicle.</p>
              
              <div className="bg-stone-50 p-6 rounded-2xl mb-8 space-y-4 border border-stone-100">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-400 uppercase">Plate</span>
                  <span className="font-mono font-bold text-xl">{scannedVehicle.plate_number}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-400 uppercase">Driver</span>
                  <span className="font-bold">{scannedVehicle.driver_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-400 uppercase">Capacity</span>
                  <span className="font-bold">{scannedVehicle.capacity} Seats</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setScannedVehicle(null)}
                  className="py-4 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleCheckIn(scannedVehicle.plate_number)}
                  className="py-4 bg-black text-white rounded-xl font-bold hover:bg-stone-800 transition-all"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
