import React, { useState, useEffect } from 'react';
import { Users, LogOut, UserCheck, Clock, MapPin, Activity, Calendar, TrendingUp, Award } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    avgProgress: 0,
    todayTasks: 0
  });

  // Tài khoản demo
  const accounts = {
    admin: { password: 'admin123', role: 'admin', name: 'Quản trị viên Hệ thống' },
    manager: { password: 'manager123', role: 'manager', name: 'Nguyễn Văn Quản lý' },
    user1: { password: 'user123', role: 'employee', name: 'Trần Thị Nhân viên' }
  };

  useEffect(() => {
    if (currentUser) {
      loadEmployeeData();
    }
  }, [currentUser]);

  const loadEmployeeData = () => {
    // Dữ liệu nhân viên chi tiết
    const mockData = [
      {
        id: 1,
        name: 'Nguyễn Văn An',
        position: 'Trưởng phòng Kinh doanh',
        department: 'Kinh doanh',
        status: 'online',
        checkIn: '08:15',
        checkOut: '--:--',
        location: 'Văn phòng HCM - Tầng 5',
        taskProgress: 85,
        tasksCompleted: 12,
        tasksTotal: 15,
        email: 'nguyenvanan@company.com',
        phone: '0901234567',
        workHours: '8h 30m',
        performance: 'Xuất sắc'
      },
      {
        id: 2,
        name: 'Trần Thị Bích',
        position: 'Chuyên viên Marketing',
        department: 'Marketing',
        status: 'online',
        checkIn: '08:30',
        checkOut: '--:--',
        location: 'Làm việc từ xa - Hà Nội',
        taskProgress: 72,
        tasksCompleted: 8,
        tasksTotal: 11,
        email: 'tranthibich@company.com',
        phone: '0912345678',
        workHours: '8h 15m',
        performance: 'Tốt'
      },
      {
        id: 3,
        name: 'Lê Văn Cường',
        position: 'Kỹ sư Phần mềm Senior',
        department: 'IT',
        status: 'online',
        checkIn: '08:00',
        checkOut: '--:--',
        location: 'Văn phòng HCM - Tầng 3',
        taskProgress: 95,
        tasksCompleted: 19,
        tasksTotal: 20,
        email: 'levancuong@company.com',
        phone: '0923456789',
        workHours: '8h 45m',
        performance: 'Xuất sắc'
      },
      {
        id: 4,
        name: 'Phạm Thị Dung',
        position: 'Nhân viên Nhân sự',
        department: 'Nhân sự',
        status: 'offline',
        checkIn: '09:00',
        checkOut: '17:30',
        location: 'Văn phòng HCM - Tầng 2',
        taskProgress: 60,
        tasksCompleted: 6,
        tasksTotal: 10,
        email: 'phamthidung@company.com',
        phone: '0934567890',
        workHours: '8h 30m',
        performance: 'Trung bình'
      },
      {
        id: 5,
        name: 'Hoàng Văn Em',
        position: 'Kế toán trưởng',
        department: 'Kế toán',
        status: 'online',
        checkIn: '08:20',
        checkOut: '--:--',
        location: 'Văn phòng HCM - Tầng 4',
        taskProgress: 78,
        tasksCompleted: 14,
        tasksTotal: 18,
        email: 'hoangvanem@company.com',
        phone: '0945678901',
        workHours: '8h 25m',
        performance: 'Tốt'
      },
      {
        id: 6,
        name: 'Vũ Thị Phương',
        position: 'Designer UI/UX',
        department: 'Sản phẩm',
        status: 'online',
        checkIn: '09:15',
        checkOut: '--:--',
        location: 'Làm việc từ xa - Đà Nẵng',
        taskProgress: 88,
        tasksCompleted: 15,
        tasksTotal: 17,
        email: 'vuthiphuong@company.com',
        phone: '0956789012',
        workHours: '7h 30m',
        performance: 'Xuất sắc'
      }
    ];

    setEmployees(mockData);

    // Tính toán thống kê
    const online = mockData.filter(e => e.status === 'online').length;
    const avgProgress = Math.round(
      mockData.reduce((acc, e) => acc + e.taskProgress, 0) / mockData.length
    );
    const todayTasks = mockData.reduce((acc, e) => acc + e.tasksCompleted, 0);

    setStats({
      total: mockData.length,
      online: online,
      avgProgress: avgProgress,
      todayTasks: todayTasks
    });
  };

  const handleLogin = () => {
    setError('');

    const account = accounts[loginForm.username];

    if (!account) {
      setError('Tên đăng nhập không tồn tại');
      return;
    }

    if (account.password !== loginForm.password) {
      setError('Mật khẩu không chính xác');
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
    setLoginForm({ username: '', password: '' });
    setEmployees([]);
    setStats({ total: 0, online: 0, avgProgress: 0, todayTasks: 0 });
  };

  const getPerformanceBadge = (performance) => {
    const badges = {
      'Xuất sắc': 'bg-green-100 text-green-700',
      'Tốt': 'bg-blue-100 text-blue-700',
      'Trung bình': 'bg-yellow-100 text-yellow-700',
      'Cần cải thiện': 'bg-red-100 text-red-700'
    };
    return badges[performance] || 'bg-gray-100 text-gray-700';
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  // Màn hình đăng nhập
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl mb-4 shadow-lg">
              <Users className="w-14 h-14 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Đăng nhập hệ thống</h1>
            <p className="text-gray-600">Quản lý nhân viên thông minh</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="Nhập tên đăng nhập"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mật khẩu
              </label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                placeholder="Nhập mật khẩu"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium flex items-center">
                <span className="mr-2">⚠️</span>
                {error}
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Đăng nhập
            </button>
          </div>

          <div className="mt-6 p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-700 font-semibold mb-3 flex items-center">
              <span className="mr-2">🔑</span>
              Tài khoản demo
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">👑 <strong>Admin:</strong></span>
                <code className="bg-white px-3 py-1 rounded-lg text-purple-600 font-mono">admin / admin123</code>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">👔 <strong>Manager:</strong></span>
                <code className="bg-white px-3 py-1 rounded-lg text-blue-600 font-mono">manager / manager123</code>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">👤 <strong>User:</strong></span>
                <code className="bg-white px-3 py-1 rounded-lg text-green-600 font-mono">user1 / user123</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Màn hình quản lý
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Hệ thống Quản lý Nhân viên</h1>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  Thứ 7, 22 tháng 11, 2025
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right bg-gray-50 px-4 py-2 rounded-xl">
                <p className="text-sm font-bold text-gray-800">{currentUser.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  {currentUser.role === 'admin' ? '👑 Quản trị viên' :
                   currentUser.role === 'manager' ? '👔 Quản lý' : '👤 Nhân viên'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-md hover:shadow-lg"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-semibold">Đăng xuất</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Thống kê tổng quan */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Tổng nhân viên</p>
                <p className="text-4xl font-bold text-gray-800">{stats.total}</p>
                <p className="text-xs text-gray-500 mt-2">👥 Toàn công ty</p>
              </div>
              <div className="p-4 bg-blue-100 rounded-2xl">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-green-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Đang làm việc</p>
                <p className="text-4xl font-bold text-green-600">{stats.online}</p>
                <p className="text-xs text-gray-500 mt-2">🟢 Online hiện tại</p>
              </div>
              <div className="p-4 bg-green-100 rounded-2xl">
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-purple-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Tiến độ TB</p>
                <p className="text-4xl font-bold text-purple-600">{stats.avgProgress}%</p>
                <p className="text-xs text-gray-500 mt-2">📊 Hiệu suất chung</p>
              </div>
              <div className="p-4 bg-purple-100 rounded-2xl">
                <Activity className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6 border-l-4 border-orange-500 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Công việc hôm nay</p>
                <p className="text-4xl font-bold text-orange-600">{stats.todayTasks}</p>
                <p className="text-xs text-gray-500 mt-2">✅ Đã hoàn thành</p>
              </div>
              <div className="p-4 bg-orange-100 rounded-2xl">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Danh sách nhân viên */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-purple-600 to-indigo-600">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Award className="w-6 h-6 mr-2" />
              Danh sách nhân viên chi tiết
            </h2>
            <p className="text-purple-100 text-sm mt-1">Theo dõi hiệu suất và công việc của từng nhân viên</p>
          </div>

          <div className="divide-y divide-gray-200">
            {employees.map((employee) => (
              <div key={employee.id} className="p-6 hover:bg-gray-50 transition-all">
                <div className="flex items-start justify-between flex-wrap lg:flex-nowrap gap-4">
                  {/* Thông tin nhân viên */}
                  <div className="flex items-start space-x-4 flex-1 min-w-0">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 via-indigo-500 to-blue-500 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg flex-shrink-0">
                      {employee.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-800">{employee.name}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPerformanceBadge(employee.performance)}`}>
                          {employee.performance}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 font-medium mb-1">{employee.position}</p>
                      <p className="text-xs text-gray-500 mb-3 break-all">📧 {employee.email} • 📱 {employee.phone}</p>

                      {/* Thông tin chi tiết */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">Check-in</p>
                            <p className="text-sm font-semibold text-gray-800">{employee.checkIn}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">Vị trí</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{employee.location}</p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Activity className="w-4 h-4 text-purple-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500">Giờ làm</p>
                            <p className="text-sm font-semibold text-gray-800">{employee.workHours}</p>
                          </div>
                        </div>

                        <div className="flex items-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center ${
                            employee.status === 'online'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {employee.status === 'online' ? '🟢 Online' : '⚫ Offline'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tiến độ công việc */}
                  <div className="w-full lg:w-72 lg:ml-6">
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-gray-700">Tiến độ công việc</span>
                        <span className="text-lg font-bold text-purple-600">{employee.taskProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-indigo-600 h-3 rounded-full transition-all shadow-sm"
                          style={{ width: `${employee.taskProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">
                          ✅ Hoàn thành: <strong>{employee.tasksCompleted}/{employee.tasksTotal}</strong>
                        </span>
                        <span className="text-gray-500">
                          🔄 Còn lại: <strong>{employee.tasksTotal - employee.tasksCompleted}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Thông báo phân quyền */}
        {currentUser.role !== 'employee' && (
          <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-6 shadow-md">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-blue-100 rounded-xl flex-shrink-0">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-2">
                  Quyền truy cập: {currentUser.role === 'admin' ? 'Quản trị viên' : 'Quản lý'}
                </h3>
                <p className="text-sm text-blue-800 leading-relaxed">
                  {currentUser.role === 'admin'
                    ? '👑 Bạn có toàn quyền quản lý hệ thống, bao gồm: quản lý nhân viên, phân quyền, xem báo cáo chi tiết và cấu hình hệ thống.'
                    : '👔 Bạn có quyền xem và theo dõi hiệu suất làm việc của nhân viên trong phòng ban của mình.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}