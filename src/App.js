// file: App.js
import React, { useState, useEffect } from 'react';
import { Users, LogOut, UserCheck, Clock, MapPin, Activity, Calendar, TrendingUp, Award, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient'; // Import từ file cấu hình chuẩn

export default function App() {
  // --- STATE QUẢN LÝ ---
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking'); // 'connected', 'error'
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    avgProgress: 0,
    todayTasks: 0
  });

  // Tài khoản demo (Hardcode cho login)
  const accounts = {
    admin: { password: 'admin123', role: 'admin', name: 'Quản trị viên Hệ thống' },
    manager: { password: 'manager123', role: 'manager', name: 'Nguyễn Văn Quản lý' },
    user1: { password: 'user123', role: 'employee', name: 'Trần Thị Nhân viên' }
  };

  // --- EFFECT & LOGIC ---
  useEffect(() => {
    if (currentUser) {
      fetchEmployees();
    }
  }, [currentUser]);

  // Hàm lấy dữ liệu từ Supabase
  const fetchEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;

      if (data) {
        setEmployees(data);
        calculateStats(data);
        setLastUpdate(new Date().toLocaleTimeString('vi-VN'));
        setConnectionStatus('connected');
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu:', err);
      setError(`Không thể kết nối dữ liệu: ${err.message}`);
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  };

  // Tính toán thống kê
  const calculateStats = (data) => {
    if (!data || data.length === 0) return;
    const online = data.filter(e => e.status === 'online').length;
    const avgProgress = Math.round(
      data.reduce((acc, e) => acc + (e.task_progress || 0), 0) / data.length
    );
    const todayTasks = data.reduce((acc, e) => acc + (e.tasks_completed || 0), 0);

    setStats({
      total: data.length,
      online: online,
      avgProgress: avgProgress || 0,
      todayTasks: todayTasks
    });
  };

  // Xử lý đăng nhập
  const handleLogin = () => {
    setError('');
    const account = accounts[loginForm.username];
    if (!account) {
      setError('Tên đăng nhập không tồn tại (Gợi ý: admin, manager)');
      return;
    }
    if (account.password !== loginForm.password) {
      setError('Mật khẩu không chính xác (Gợi ý: admin123)');
      return;
    }
    setCurrentUser({
      username: loginForm.username,
      role: account.role,
      name: account.name
    });
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmployees([]);
    setLoginForm({ username: '', password: '' });
  };

  // Helper UI
  const getPerformanceBadge = (performance) => {
    const badges = {
      'Xuất sắc': 'bg-green-100 text-green-700',
      'Tốt': 'bg-blue-100 text-blue-700',
      'Trung bình': 'bg-yellow-100 text-yellow-700',
      'Cần cải thiện': 'bg-red-100 text-red-700'
    };
    return badges[performance] || 'bg-gray-100 text-gray-700';
  };

  // --- GIAO DIỆN ĐĂNG NHẬP ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
              <Users className="w-14 h-14 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Đăng nhập</h1>
            <p className="text-gray-600">Quản lý nhân sự</p>
          </div>

          <div className="space-y-5">
            <input
              type="text"
              value={loginForm.username}
              onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 outline-none transition-all"
              placeholder="Tên đăng nhập (admin)"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 outline-none transition-all"
              placeholder="Mật khẩu (admin123)"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" /> {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
            >
              Đăng nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- GIAO DIỆN DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-purple-600 animate-spin mb-3" />
            <span className="text-gray-600 font-medium">Đang đồng bộ dữ liệu...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Quản lý Nhân Sự</h1>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                {connectionStatus === 'connected' ?
                  <span className="text-green-600 flex items-center gap-1">● Đã kết nối Supabase</span> :
                  <span className="text-red-500 flex items-center gap-1">● Mất kết nối</span>
                }
                {lastUpdate && <span>| Cập nhật: {lastUpdate}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={fetchEmployees} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors" title="Làm mới">
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="h-8 w-px bg-gray-200 mx-1"></div>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-gray-800">{currentUser.name}</div>
              <div className="text-xs text-gray-500 capitalize">{currentUser.role}</div>
            </div>
            <button onClick={handleLogout} className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-2">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Thoát</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Báo lỗi nếu có */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg flex items-center text-red-700 shadow-sm">
             <AlertCircle className="w-6 h-6 mr-3 flex-shrink-0" />
             <div>
               <p className="font-bold">Lỗi kết nối</p>
               <p className="text-sm">{error}</p>
             </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={Users} color="blue" label="Tổng nhân sự" value={stats.total} sub="Người" />
          <StatCard icon={UserCheck} color="green" label="Đang Online" value={stats.online} sub="Đang hoạt động" />
          <StatCard icon={Activity} color="purple" label="Tiến độ TB" value={`${stats.avgProgress}%`} sub="Hiệu suất chung" />
          <StatCard icon={TrendingUp} color="orange" label="Việc hoàn thành" value={stats.todayTasks} sub="Task hôm nay" />
        </div>

        {/* Employee List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" /> Danh sách nhân viên
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {employees.length === 0 && !loading ? (
              <div className="p-12 text-center text-gray-400">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p>Chưa có dữ liệu nhân viên.</p>
                <p className="text-sm mt-2">Hãy thêm dữ liệu vào bảng 'employees' trên Supabase.</p>
              </div>
            ) : (
              employees.map((emp) => (
                <div key={emp.id} className="p-6 hover:bg-gray-50 transition-colors group">
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* Avatar & Basic Info */}
                    <div className="flex gap-4 flex-1">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0">
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-lg">{emp.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPerformanceBadge(emp.performance)}`}>
                            {emp.performance}
                          </span>
                        </div>
                        <p className="text-indigo-600 font-medium text-sm">{emp.position}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                           <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {emp.location || 'N/A'}</span>
                           <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Check-in: {emp.check_in || '--:--'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Progress */}
                    <div className="flex flex-col justify-center md:w-64 gap-3">
                      <div className="flex justify-between items-center text-sm">
                         <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${emp.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                           <div className={`w-2 h-2 rounded-full ${emp.status === 'online' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                           {emp.status === 'online' ? 'Online' : 'Offline'}
                         </span>
                         <span className="text-gray-500 text-xs font-medium">{emp.work_hours || '0h'} làm việc</span>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-600 font-medium">Tiến độ: {emp.task_progress}%</span>
                          <span className="text-gray-400">{emp.tasks_completed}/{emp.tasks_total} việc</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            style={{ width: `${emp.task_progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// Component con để code gọn hơn
function StatCard({ icon: Icon, color, label, value, sub }) {
  const colors = {
    blue: 'text-blue-600 bg-blue-100 border-blue-200',
    green: 'text-green-600 bg-green-100 border-green-200',
    purple: 'text-purple-600 bg-purple-100 border-purple-200',
    orange: 'text-orange-600 bg-orange-100 border-orange-200',
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
          <p className="text-xs text-gray-400 mt-2">{sub}</p>
        </div>
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}