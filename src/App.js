import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw, Camera, Trash2, Plus,
  CheckCircle2, Clock, Send, Loader2,
  LayoutDashboard, Menu, X, ShieldCheck,
  Users, ListTodo, Image as ImageIcon, MapPin, Briefcase,
  CalendarClock, AlertTriangle, AlertCircle, ExternalLink,
  Edit3, ArrowUp, ArrowDown, Copy, Key
} from 'lucide-react';

// --- UTILS ---
const getTodayISO = () => {
  const tzOffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzOffset)).toISOString().split('T')[0];
};

const showNotify = (setter, msg, type = 'success') => {
  setter({ msg, type });
  setTimeout(() => setter({ msg: '', type: '' }), 3000);
};

// Hàm lấy vị trí GPS
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Trình duyệt không hỗ trợ định vị."));
    } else {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          let msg = "Lỗi lấy vị trí.";
          switch (error.code) {
            case error.PERMISSION_DENIED: msg = "Bạn đã từ chối quyền truy cập vị trí."; break;
            case error.POSITION_UNAVAILABLE: msg = "Không xác định được vị trí."; break;
            case error.TIMEOUT: msg = "Hết thời gian chờ lấy vị trí."; break;
            default: break;
          }
          reject(new Error(msg));
        },
        options
      );
    }
  });
};

// ==========================================
// 1. STAFF DASHBOARD (CÓ CẢNH BÁO NHẤP NHÁY)
// ==========================================
const StaffDashboard = ({ user, tasks, reportData, onUpdateLocal, setNotify }) => {
  const [attendance, setAttendance] = useState({ in: null, out: null });
  const [loadingSend, setLoadingSend] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [now, setNow] = useState(new Date()); // Thời gian thực

  // Cập nhật đồng hồ mỗi giây để kích hoạt cảnh báo
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    checkAttendanceStatus();
    return () => clearInterval(timer);
  }, []);

  const checkAttendanceStatus = async () => {
    const today = getTodayISO();
    const { data } = await supabase.from('time_logs').select('*').eq('user_id', user.id).eq('report_date', today);
    if (data) {
      const checkIn = data.find(x => x.action_type === 'check_in');
      const checkOut = data.find(x => x.action_type === 'check_out');
      setAttendance({
        in: checkIn ? new Date(checkIn.log_time).toLocaleTimeString('vi-VN') : null,
        out: checkOut ? new Date(checkOut.log_time).toLocaleTimeString('vi-VN') : null
      });
    }
  };

  const handleAttendanceCapture = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setAttLoading(true);
    setNotify("Đang định vị và tải ảnh...", "info");
    try {
      const location = await getCurrentLocation();
      const fileExt = file.name.split('.').pop();
      const fileName = `attendance/${user.username}_${type}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('task-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(fileName);

      const { error } = await supabase.from('time_logs').insert({
        user_id: user.id, action_type: type, report_date: getTodayISO(), image_url: publicUrl, lat: location.lat, lng: location.lng
      });
      if (error) throw error;
      setNotify(`Đã ${type === 'check_in' ? 'Check-in' : 'Check-out'} thành công!`);
      checkAttendanceStatus();
    } catch (err) {
      console.error(err);
      setNotify(err.message || "Lỗi GPS/Mạng", "error");
    } finally { setAttLoading(false); }
  };

  const handleTaskAction = async (taskDefId, actionType, value) => {
    const currentTaskData = reportData[taskDefId] || {};
    if (currentTaskData.sent) return;
    let updatedItem = { ...currentTaskData };
    if (actionType === 'toggle') {
      const isDone = !updatedItem.done;
      updatedItem = { ...updatedItem, done: isDone, time: isDone ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '' };
    } else if (actionType === 'input') updatedItem.val = value;
    else if (actionType === 'image') updatedItem.imageUrl = value;
    onUpdateLocal({ ...reportData, [taskDefId]: updatedItem });
  };

  const sendSingleTask = async (taskDefId) => {
    const item = reportData[taskDefId];
    if (!item || !item.done) return setNotify("Chưa hoàn thành!", "error");
    const taskDef = tasks.find(t => t.id === taskDefId);
    if (taskDef?.require_input && !item.val) return setNotify("Thiếu thông tin số liệu!", "error");
    if (taskDef?.require_image && !item.imageUrl) return setNotify("Thiếu ảnh minh chứng!", "error");

    setLoadingSend(taskDefId);
    try {
      item.sent = true;
      const newReportData = { ...reportData, [taskDefId]: item };
      const { error } = await supabase.from('checklist_logs').upsert({ report_date: getTodayISO(), role: user.role, data: newReportData }, { onConflict: 'report_date, role' });
      if (error) throw error;
      onUpdateLocal(newReportData);
      setNotify("Đã gửi báo cáo!");
    } catch (err) {
      item.sent = false; onUpdateLocal({ ...reportData, [taskDefId]: item });
      setNotify("Gửi lỗi", "error");
    } finally { setLoadingSend(null); }
  };

  const handleImageUpload = async (e, taskDefId) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      setNotify("Đang tải ảnh...", "info");
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.username}_${taskDefId}_${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('task-images').upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('task-images').getPublicUrl(fileName);
      handleTaskAction(taskDefId, 'image', publicUrl);
      setNotify("Tải ảnh thành công");
    } catch (error) { setNotify("Lỗi tải ảnh", "error"); }
  };

  // Logic kiểm tra đến giờ (để nhấp nháy)
  const checkIsDue = (timeLabel, isDone) => {
    if (isDone || !timeLabel || !timeLabel.includes(':')) return false;
    const [h, m] = timeLabel.split(':').map(Number);
    const taskTime = new Date();
    taskTime.setHours(h, m, 0, 0);
    return now >= taskTime;
  };

  // Logic kiểm tra trễ (để hiện chữ Late)
  const checkIsLate = (timeLabel, lateBuffer, isDone) => {
    if (!timeLabel || !timeLabel.includes(':')) return false;
    const [h, m] = timeLabel.split(':').map(Number);
    const limit = new Date();
    limit.setHours(h, m + (lateBuffer || 15), 0, 0);
    return !isDone && (now > limit);
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => reportData[t.id]?.sent).length;
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  return (
    <div className="space-y-6">
      {/* Tiến độ */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-end mb-2">
          <span className="font-bold text-slate-700">Tiến độ hôm nay</span>
          <span className="text-blue-600 font-bold text-lg">{progressPercent}%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
        </div>
        <p className="text-xs text-slate-400 mt-2 text-right">{completedTasks}/{totalTasks} công việc đã gửi</p>
      </div>

      {/* Chấm công */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-slate-800">Chấm công</h2><p className="text-slate-500 text-sm">Chụp ảnh để vào/ra ca</p></div>
        {attLoading ? (
          <div className="flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-6 py-3 rounded-xl animate-pulse">
            <Loader2 className="animate-spin" /> Đang xử lý GPS...
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="relative">
              <input type="file" accept="image/*" capture="user" id="att-in" className="hidden" disabled={!!attendance.in} onChange={(e) => handleAttendanceCapture(e, 'check_in')} />
              <label htmlFor="att-in" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.in ? 'bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30'}`}>
                <MapPin size={18} /> {attendance.in ? `Vào: ${attendance.in}` : 'Check In'}
              </label>
            </div>
            <div className="relative">
              <input type="file" accept="image/*" capture="user" id="att-out" className="hidden" disabled={!attendance.in || !!attendance.out} onChange={(e) => handleAttendanceCapture(e, 'check_out')} />
              <label htmlFor="att-out" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.out ? 'bg-slate-100 text-slate-400 pointer-events-none' : (!attendance.in ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100')}`}>
                <LogOut size={18} /> {attendance.out ? `Ra: ${attendance.out}` : 'Check Out'}
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Danh sách công việc */}
      <div className="grid gap-4">
        {tasks.map((task) => {
          const item = reportData[task.id] || {};
          const isDone = item.done;
          const isSent = item.sent;
          const isDue = checkIsDue(task.time_label, isDone);
          const isLate = checkIsLate(task.time_label, task.late_buffer, isDone);

          // Class nhấp nháy cảnh báo
          const alertClass = (isDue && !isDone) ? "animate-pulse ring-2 ring-red-400 bg-red-50 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]" : "";
          const baseClass = isSent ? 'border-emerald-100 bg-emerald-50/20' : (isLate ? 'border-red-500 bg-red-50' : (isDone ? 'border-blue-100' : 'border-transparent shadow-sm'));

          return (
            <div key={task.id} className={`bg-white p-4 rounded-xl border-2 transition-all ${alertClass || baseClass}`}>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => !isSent && handleTaskAction(task.id, 'toggle')}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDone ? (isSent ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600') : ((isLate || isDue) ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-300')}`}>
                    {(isLate || isDue) && !isDone ? <AlertTriangle size={20} className={isDue ? "animate-bounce" : ""} /> : <CheckCircle2 size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs mb-1">
                      {task.time_label && (
                        <span className={`font-bold px-2 py-0.5 rounded flex items-center gap-1 ${isLate && !isDone ? 'bg-red-600 text-white' : (isDue && !isDone ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500')}`}>
                          <Clock size={10} /> {task.time_label} {isLate && !isDone ? ' (TRỄ)' : ''} {isDue && !isLate && !isDone ? ' (LÀM NGAY)' : ''}
                        </span>
                      )}
                      {item.time && <span className="text-blue-600 font-medium border border-blue-100 px-2 py-0.5 rounded bg-blue-50">Xong lúc: {item.time}</span>}
                    </div>
                    <h3 className={`font-semibold ${isLate && !isDone ? 'text-red-700' : 'text-slate-800'}`}>{task.title}</h3>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center mt-2 md:mt-0 pl-12 md:pl-0">
                  {task.require_input && <input disabled={!isDone || isSent} value={item.val || ''} onChange={(e) => handleTaskAction(task.id, 'input', e.target.value)} placeholder="Số liệu..." className="w-full sm:w-24 px-3 py-2 text-sm border rounded-lg text-center bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" />}
                  {task.require_image && (<div className="relative"><input type="file" id={`file-${task.id}`} className="hidden" accept="image/*" disabled={!isDone || isSent} onChange={(e) => handleImageUpload(e, task.id)} /><label htmlFor={`file-${task.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer transition-all ${!isDone || isSent ? 'bg-slate-100 text-slate-400' : 'bg-white hover:bg-slate-50'}`}>{item.imageUrl ? <span className="text-indigo-600 flex gap-1"><ImageIcon size={16} />Xem</span> : <span><Camera size={16} />Ảnh</span>}</label></div>)}
                  {isDone && !isSent && <button onClick={() => sendSingleTask(task.id)} disabled={loadingSend === task.id} className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg hover:bg-blue-700">{loadingSend === task.id ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}</button>}
                  {isSent && <span className="text-emerald-600 font-bold text-xs bg-emerald-100 px-3 py-2 rounded-lg border border-emerald-200"><CheckCircle2 size={14} className="inline mr-1" />Đã gửi</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// 2. ADMIN TASK MANAGER (FIXED: SORT & EDIT)
// ==========================================
const AdminTaskManager = ({ allTasks, roles, onRefresh, setNotify }) => {
  const [editing, setEditing] = useState({
    id: null,
    role: '',
    title: '',
    time_label: '',
    late_buffer: 15, // Mặc định 15
    require_input: false,
    require_image: false,
    sort_order: 1
  });

  useEffect(() => {
    if (roles.length > 0 && !editing.role && !editing.id) {
      setEditing(prev => ({ ...prev, role: roles[0].code }));
    }
  }, [roles]);

  const resetForm = () => {
    setEditing({ id: null, role: roles[0]?.code || '', title: '', time_label: '', late_buffer: 15, require_input: false, require_image: false, sort_order: 1 });
  };

  const handleSaveTask = async () => {
    if (!editing.title) return setNotify("Chưa nhập tên công việc", "error");
    const payload = {
      role: editing.role, title: editing.title, time_label: editing.time_label,
      late_buffer: editing.late_buffer, require_input: editing.require_input,
      require_image: editing.require_image
    };

    if (editing.id) {
      const { error } = await supabase.from('task_definitions').update(payload).eq('id', editing.id);
      if (error) setNotify("Lỗi cập nhật: " + error.message, "error");
      else { setNotify("Đã cập nhật!"); onRefresh(); resetForm(); }
    } else {
      const maxOrder = allTasks.filter(t => t.role === editing.role).length + 1;
      const { error } = await supabase.from('task_definitions').insert({ ...payload, sort_order: maxOrder });
      if (error) setNotify("Lỗi tạo việc: " + error.message, "error");
      else { setNotify("Đã thêm công việc"); onRefresh(); resetForm(); }
    }
  };

  const handleEdit = (task) => {
    setEditing({ ...task, late_buffer: task.late_buffer !== null ? task.late_buffer : 15 });
    // Cuộn lên đầu trang
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Hoặc cuộn đến phần tử top nếu trong container scroll
    document.getElementById('task-manager-top')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("Xóa việc này?")) return;
    const { error } = await supabase.from('task_definitions').delete().eq('id', id);
    if (!error) { setNotify("Đã xóa"); onRefresh(); }
  };

  const handleMove = async (task, direction) => {
    let roleTasks = allTasks.filter(t => t.role === task.role).sort((a, b) => a.sort_order - b.sort_order);
    const index = roleTasks.findIndex(t => t.id === task.id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === roleTasks.length - 1)) return;

    // Swap local
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [roleTasks[index], roleTasks[targetIndex]] = [roleTasks[targetIndex], roleTasks[index]];

    // Update DB (Re-index 1..n)
    setNotify("Đang sắp xếp...", "info");
    const updates = roleTasks.map((t, idx) => supabase.from('task_definitions').update({ sort_order: idx + 1 }).eq('id', t.id));
    await Promise.all(updates);
    onRefresh();
  };

  return (
    <div className="space-y-6" id="task-manager-top">
      {/* Form */}
      <div className={`p-4 rounded-xl border grid grid-cols-2 md:grid-cols-6 gap-3 transition-all ${editing.id ? 'bg-amber-50 border-amber-200 shadow-md ring-2 ring-amber-100' : 'bg-indigo-50 border-indigo-100'}`}>
        <div className="col-span-2 md:col-span-6 flex justify-between items-center mb-2">
          <h3 className="font-bold text-sm uppercase text-slate-500">{editing.id ? `Đang sửa: ${editing.title}` : 'Thêm công việc mới'}</h3>
          {editing.id && <button onClick={resetForm} className="text-xs bg-slate-200 px-2 py-1 rounded hover:bg-slate-300">Hủy sửa</button>}
        </div>

        <div className="col-span-2 md:col-span-1">
          <label className="text-xs font-bold text-indigo-800 block mb-1">Khu vực</label>
          <select className="w-full p-2 rounded border text-sm" value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} disabled={!!editing.id}>
            {roles.map(r => (<option key={r.code} value={r.code}>{r.name}</option>))}
          </select>
        </div>
        <div className="col-span-2 md:col-span-2">
          <label className="text-xs font-bold text-indigo-800 block mb-1">Tên công việc</label>
          <input className="w-full p-2 rounded border text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="VD: Dọn hồ cá" value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
        </div>
        <div className="col-span-1">
          <label className="text-xs font-bold text-indigo-800 block mb-1">Giờ (VD: 15:30)</label>
          <input className="w-full p-2 rounded border text-sm" placeholder="HH:MM" value={editing.time_label} onChange={e => setEditing({ ...editing, time_label: e.target.value })} />
        </div>
        <div className="col-span-1">
          <label className="text-xs font-bold text-indigo-800 block mb-1">Cho trễ (phút)</label>
          <input type="number" className="w-full p-2 rounded border text-sm font-bold text-blue-600" placeholder="15" value={editing.late_buffer} onChange={e => setEditing({ ...editing, late_buffer: parseInt(e.target.value) || 0 })} />
        </div>
        <div className="col-span-2 md:col-span-1 flex flex-col justify-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.require_input} onChange={e => setEditing({ ...editing, require_input: e.target.checked })} /> Nhập số liệu?</label>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={editing.require_image} onChange={e => setEditing({ ...editing, require_image: e.target.checked })} /> Chụp ảnh?</label>
        </div>
        <div className="col-span-2 flex items-end gap-2">
          {editing.id && <button onClick={resetForm} className="flex-1 bg-slate-200 text-slate-600 p-2 rounded font-bold text-sm">Hủy</button>}
          <button onClick={handleSaveTask} className={`flex-1 text-white p-2 rounded font-bold text-sm shadow-lg ${editing.id ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{editing.id ? 'Lưu thay đổi' : 'Thêm mới'}</button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {roles.map(role => {
          const tasks = allTasks.filter(t => t.role === role.code);
          if (tasks.length === 0) return null;
          return (
            <div key={role.code} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 p-3 border-b border-slate-100 font-bold text-slate-700 flex justify-between">{role.name} <span className="text-xs font-normal bg-white border px-2 rounded flex items-center">{role.code}</span></div>
              {tasks.map((t, idx) => (
                <div key={t.id} className={`p-3 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50 ${editing.id === t.id ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => handleMove(t, 'up')} disabled={idx === 0} className="text-slate-300 hover:text-blue-600 disabled:opacity-0 p-1 bg-slate-50 rounded hover:bg-blue-100"><ArrowUp size={14} /></button>
                      <button onClick={() => handleMove(t, 'down')} disabled={idx === tasks.length - 1} className="text-slate-300 hover:text-blue-600 disabled:opacity-0 p-1 bg-slate-50 rounded hover:bg-blue-100"><ArrowDown size={14} /></button>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-700 flex items-center gap-2">{t.title} {editing.id === t.id && <span className="text-[10px] bg-amber-200 text-amber-800 px-1 rounded">Đang sửa</span>}</p>
                      <p className="text-xs text-slate-400">
                        {t.time_label ? `Lúc: ${t.time_label}` : 'Không fix giờ'} <span className="text-blue-500 font-medium"> (+{t.late_buffer}p trễ)</span>
                        {t.require_input && ' | Nhập số'} {t.require_image && ' | Chụp ảnh'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(t)} className="text-blue-500 hover:bg-blue-50 p-2 rounded transition-all"><Edit3 size={16} /></button>
                    <button onClick={() => handleDeleteTask(t.id)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==========================================
// 3. ADMIN DASHBOARD (CONTAINER)
// ==========================================
const AdminDashboard = ({ user, allTasks, roles, onRefresh, setNotify }) => {
  const [activeTab, setActiveTab] = useState('tasks');
  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab('tasks')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'tasks' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}><ListTodo size={16} className="inline mr-2" />Quản lý công việc</button>
        <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-colors ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50 border'}`}><Users size={16} className="inline mr-2" />Quản lý nhân sự</button>
      </div>

      {activeTab === 'tasks' ? (
        <AdminTaskManager allTasks={allTasks} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />
      ) : (
        <div className="bg-white p-8 text-center text-slate-500 rounded-xl border border-dashed border-slate-300">
            <Users size={48} className="mx-auto text-slate-300 mb-4"/>
            <p>Tính năng quản lý nhân sự đang cập nhật...</p>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [notification, setNotification] = useState({ msg: '', type: '' });
  const [data, setData] = useState({ tasks: [], roles: [], reportData: {} });

  // Load User & Data
  useEffect(() => {
    const session = supabase.auth.session();
    if (session?.user) fetchUserData(session.user.id);
    else setLoading(false);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') fetchUserData(session.user.id);
      else if (event === 'SIGNED_OUT') { setUser(null); setData({ tasks: [], roles: [], reportData: {} }); }
    });
    return () => authListener?.unsubscribe();
  }, []);

  const fetchUserData = async (userId) => {
    setLoading(true);
    try {
      const { data: userProfile, error } = await supabase.from('users').select('*').eq('id', userId).single();
      if (error) throw error;
      setUser(userProfile);
      await fetchData(userProfile.role);
    } catch (error) {
      console.error(error);
      showNotify(setNotification, "Lỗi tải dữ liệu người dùng", "error");
    } finally { setLoading(false); }
  };

  const fetchData = async (role) => {
    try {
      const { data: roles } = await supabase.from('roles').select('*');
      const { data: tasks } = await supabase.from('task_definitions').select('*').order('sort_order', { ascending: true });

      let reportData = {};
      if (role !== 'admin') {
        const today = getTodayISO();
        const { data: logs } = await supabase.from('checklist_logs').select('data').eq('report_date', today).eq('role', role).single();
        if (logs) reportData = logs.data;
      }

      setData({ roles: roles || [], tasks: tasks || [], reportData });
    } catch (error) { console.error("Fetch Data Error", error); }
  };

  const handleLogin = async () => {
    setLoading(true);
    const { user: authUser, error } = await supabase.auth.signIn({ email: `${loginForm.username}@hoca.com`, password: loginForm.password });
    if (error) {
      showNotify(setNotification, "Sai tài khoản hoặc mật khẩu!", "error");
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const updateLocalReport = (newData) => {
    setData(prev => ({ ...prev, reportData: newData }));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-blue-600"><Loader2 size={40} className="animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Đăng Nhập Hệ Thống</h1>
            <p className="text-slate-400 text-sm mt-1">Quản lý vận hành hồ cá</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input type="text" placeholder="Tên đăng nhập" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input type="password" placeholder="Mật khẩu" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            {notification.msg && <div className={`text-sm text-center font-bold p-2 rounded ${notification.type === 'error' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>{notification.msg}</div>}
            <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">
              <Key size={18} /> Đăng Nhập
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN LAYOUT FOR LOGGED IN USER ---
  const myTasks = user.role === 'admin' ? data.tasks : data.tasks.filter(t => t.role === user.role);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-10">
      {/* HEADER */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-md font-bold text-lg">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-bold text-slate-800">{user.full_name || user.username}</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{user.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"><LogOut size={20} /></button>
        </div>
      </div>

      {/* NOTIFICATION TOAST */}
      {notification.msg && (
        <div className="fixed top-20 right-4 z-50 animate-bounce">
          <div className={`px-6 py-3 rounded-lg shadow-xl text-white font-bold flex items-center gap-2 ${notification.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
            {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            {notification.msg}
          </div>
        </div>
      )}

      {/* BODY CONTENT */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {user.role === 'admin' ? (
          <AdminDashboard user={user} allTasks={data.tasks} roles={data.roles} onRefresh={() => fetchData('admin')} setNotify={(m, t) => showNotify(setNotification, m, t)} />
        ) : (
          <StaffDashboard user={user} tasks={myTasks} reportData={data.reportData} onUpdateLocal={updateLocalReport} setNotify={(m, t) => showNotify(setNotification, m, t)} />
        )}
      </div>
    </div>
  );
}