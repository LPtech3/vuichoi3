import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  User, Lock, LogOut, Save, RefreshCcw, 
  CheckCircle2, Circle, Clock, FileText, send 
} from 'lucide-react';

// --- 1. CẤU HÌNH SUPABASE (Giữ nguyên) ---
const SUPABASE_URL = 'https://fjpgxvroomyiphhgnezo.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_lLMFT2OAjmU2bfp9Uq1RpQ_FzUa0mFi';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 2. DỮ LIỆU CẤU HÌNH (Giữ nguyên logic) ---
const USERS = {
  admin: { name: "Quản Lý", role: "admin" },
  nam_np: { name: "Nam Nhà Phao", role: "nam_np" },
  nu_np: { name: "Nữ Nhà Phao", role: "nu_np" },
  nam_xd: { name: "Nam Xe Điện", role: "nam_xd" },
  nu_xd: { name: "Nữ Xe Điện", role: "nu_xd" }
};

const CHECKLISTS = {
  nam_np: { title: "Khu Nhà Phao (Nam)", tasks: [
      {t:"15:30", d:"Check-in, Dọn xe"}, {t:"16:00", d:"Dán ống, bơm, gỡ bạt"}, {t:"16:00", d:"Dọn hồ cá, bơm nước"},
      {t:"Khi đầy", d:"Lau nhà hơi"}, {t:"17:30", d:"Treo đèn"}, {t:"18:30", d:"Nhặt rác"},
      {t:"20:00", d:"Xả nhà phao, gấp bạt"}, {t:"Cuối ca", d:"Báo số nước", input:true},
      {t:"Cuối ca", d:"Tắt đèn, rút điện"}, {t:"21:00", d:"Check-out", input:true}
  ]},
  nu_np: { title: "Khu Nhà Phao (Nữ)", tasks: [
      {t:"15:30", d:"Check-in, Phụ dọn"}, {t:"Đầu ca", d:"Kiểm kê nước đầu ca", input:true},
      {t:"18:00", d:"Đốt nhang muỗi"}, {t:"18:30", d:"Nhặt rác"}, {t:"20:00", d:"Dọn dẹp, kéo bạt"},
      {t:"Cuối ca", d:"Kiểm kê nước cuối ca", input:true}, {t:"Cuối ca", d:"Sạc đèn"}, {t:"21:00", d:"Check-out"}
  ]},
  // Thêm các role khác nếu cần
};

// --- 3. COMPONENT CHÍNH ---
export default function App() {
  // State quản lý trạng thái ứng dụng
  const [user, setUser] = useState(null); // Thay cho biến currentUser
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [checklistData, setChecklistData] = useState({}); // Thay cho biến globalData
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');

  // --- HÀM HỖ TRỢ (Utility) ---
  function getTodayISO() {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, -1);
    return localISOTime.split('T')[0];
  }

  function showNotify(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  }

  // --- TƯƠNG TÁC SUPABASE ---
  async function fetchTodayData() {
    setLoading(true);
    const today = getTodayISO();
    try {
      let { data, error } = await supabase
        .from('checklist_logs')
        .select('role, data')
        .eq('report_date', today);
      
      if (error) throw error;

      const newData = {};
      if (data && data.length > 0) {
        data.forEach(row => { newData[row.role] = row.data; });
      }
      setChecklistData(newData);
      showNotify("✅ Đã đồng bộ dữ liệu!");
    } catch (err) {
      console.error(err);
      showNotify("❌ Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  async function pushData() {
    if (!user) return;
    setLoading(true);
    const today = getTodayISO();
    const myRoleData = checklistData[user.role] || {};
    
    try {
      // Đánh dấu là đã gửi (sent = true) cho các mục đã check
      const dataToSend = { ...myRoleData };
      Object.keys(dataToSend).forEach(key => {
        if (dataToSend[key].done) dataToSend[key].sent = true;
      });

      const { error } = await supabase
        .from('checklist_logs')
        .upsert({
          report_date: today,
          role: user.role,
          data: dataToSend
        }, { onConflict: 'report_date, role' });

      if (error) throw error;
      showNotify("☁️ Gửi thành công lên Server!");
      await fetchTodayData(); // Tải lại để cập nhật trạng thái sent
    } catch (err) {
      console.error(err);
      showNotify("❌ Lỗi gửi dữ liệu");
    } finally {
      setLoading(false);
    }
  }

  // Tự động tải dữ liệu khi đăng nhập thành công
  useEffect(() => {
    if (user) {
      fetchTodayData();
    }
  }, [user]);

  // --- XỬ LÝ GIAO DIỆN ---
  const handleLogin = () => {
    const u = loginForm.username;
    const p = loginForm.password;
    
    // Giả lập logic check pass '123' như code cũ
    if (USERS[u] && p === '123') {
      setUser({ ...USERS[u], username: u });
    } else {
      showNotify("❌ Sai thông tin đăng nhập!");
    }
  };

  const handleTaskToggle = (taskIndex) => {
    // Logic: Clone state -> Sửa -> Set lại state
    const currentRoleData = { ...(checklistData[user.role] || {}) };
    const taskItem = currentRoleData[taskIndex] || {};

    if (taskItem.sent) {
      showNotify("⚠️ Mục này đã gửi, không thể sửa!");
      return;
    }

    // Toggle trạng thái done
    const isDone = !taskItem.done;
    
    currentRoleData[taskIndex] = {
      ...taskItem,
      done: isDone,
      time: isDone ? new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : ''
    };

    setChecklistData({ ...checklistData, [user.role]: currentRoleData });
  };

  const handleInputChange = (taskIndex, value) => {
    const currentRoleData = { ...(checklistData[user.role] || {}) };
    const taskItem = currentRoleData[taskIndex] || {};

    if (taskItem.sent) return;

    currentRoleData[taskIndex] = {
      ...taskItem,
      val: value
    };
    setChecklistData({ ...checklistData, [user.role]: currentRoleData });
  };

  // --- RENDER MÀN HÌNH ---

  // 1. Màn hình Login
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Checklist App</h1>
            <p className="text-gray-500">Hệ thống báo cáo công việc</p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center border-2 rounded-xl px-3 py-2">
              <User className="text-gray-400 mr-2" />
              <input 
                type="text" 
                placeholder="Username (vd: nam_np)" 
                className="w-full outline-none"
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              />
            </div>
            <div className="flex items-center border-2 rounded-xl px-3 py-2">
              <Lock className="text-gray-400 mr-2" />
              <input 
                type="password" 
                placeholder="Password" 
                className="w-full outline-none"
                value={loginForm.password}
                onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
              Đăng nhập
            </button>
            {notification && <p className="text-red-500 text-center text-sm">{notification}</p>}
          </div>
        </div>
      </div>
    );
  }

  // 2. Màn hình Dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-xl text-gray-800">{user.name}</h2>
            <p className="text-xs text-gray-500">{user.role} • {getTodayISO()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchTodayData} className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200" title="Làm mới">
              <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setUser(null)} className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200" title="Đăng xuất">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-bounce">
          {notification}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
        
        {/* ADMIN VIEW */}
        {user.role === 'admin' ? (
          <div className="space-y-6">
             <h3 className="text-lg font-bold text-gray-700">Tổng hợp báo cáo</h3>
             {Object.keys(CHECKLISTS).map(roleKey => {
               const roleTasks = checklistData[roleKey] || {};
               const config = CHECKLISTS[roleKey];
               return (
                 <div key={roleKey} className="bg-white p-4 rounded-xl shadow-sm border">
                   <h4 className="font-bold text-blue-600 border-b pb-2 mb-2">{config.title}</h4>
                   <div className="space-y-1">
                     {Object.keys(roleTasks).map(idx => {
                       const task = roleTasks[idx];
                       if(task.sent) {
                         return (
                           <div key={idx} className="text-sm flex justify-between items-center bg-green-50 p-2 rounded">
                             <span>✅ Task {idx}: {task.time}</span>
                             {task.val && <span className="font-mono text-gray-600">"{task.val}"</span>}
                           </div>
                         )
                       }
                       return null;
                     })}
                     {Object.keys(roleTasks).filter(k => roleTasks[k].sent).length === 0 && <p className="text-gray-400 text-sm italic">Chưa có dữ liệu</p>}
                   </div>
                 </div>
               )
             })}
          </div>
        ) : (
          
        /* STAFF VIEW */
        <div className="space-y-3">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-lg font-bold text-gray-700">Danh sách công việc</h3>
             <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
               {CHECKLISTS[user.role]?.title}
             </span>
           </div>

           {CHECKLISTS[user.role]?.tasks.map((task, idx) => {
             const myData = checklistData[user.role] || {};
             const item = myData[idx] || {};
             const isDone = item.done;
             const isSent = item.sent;

             return (
               <div key={idx} 
                 className={`bg-white p-4 rounded-xl border transition-all ${isDone ? 'border-green-500 shadow-md' : 'border-gray-200'}`}
               >
                 <div className="flex items-start gap-3">
                   {/* Checkbox Button */}
                   <button 
                     onClick={() => handleTaskToggle(idx)}
                     disabled={isSent}
                     className={`mt-1 flex-shrink-0 transition-colors ${isSent ? 'text-gray-400 cursor-not-allowed' : (isDone ? 'text-green-500' : 'text-gray-300 hover:text-gray-400')}`}
                   >
                     {isDone ? <CheckCircle2 size={28} /> : <Circle size={28} />}
                   </button>

                   <div className="flex-1">
                     <div className="flex justify-between items-start">
                        <span className={`font-medium text-gray-800 ${isDone && 'line-through text-gray-400'}`}>
                          {task.d}
                        </span>
                        <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-600">
                          {item.time || task.t}
                        </span>
                     </div>

                     {/* Input field nếu task yêu cầu */}
                     {task.input && (
                       <div className={`mt-3 flex items-center bg-gray-50 px-3 py-2 rounded-lg ${!isDone && 'opacity-50'}`}>
                         <FileText size={16} className="text-gray-400 mr-2"/>
                         <input 
                            type="text"
                            disabled={!isDone || isSent}
                            value={item.val || ''}
                            onChange={(e) => handleInputChange(idx, e.target.value)}
                            placeholder="Nhập số liệu/ghi chú..."
                            className="bg-transparent w-full outline-none text-sm text-gray-700"
                         />
                       </div>
                     )}
                     
                     {isSent && <p className="text-xs text-green-600 mt-1 font-semibold">✓ Đã gửi server</p>}
                   </div>
                 </div>
               </div>
             )
           })}
        </div>
        )}
      </div>

      {/* Floating Action Button (Nút gửi) - Chỉ hiện cho Staff */}
      {user.role !== 'admin' && (
        <div className="fixed bottom-6 left-0 right-0 px-4 max-w-4xl mx-auto">
          <button 
            onClick={pushData}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all transform active:scale-95 flex justify-center items-center gap-2"
          >
            {loading ? <RefreshCcw className="animate-spin" /> : <Save />}
            {loading ? "Đang xử lý..." : "Gửi báo cáo lên Server"}
          </button>
        </div>
      )}
    </div>
  );
}