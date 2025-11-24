import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient'; // Đảm bảo bạn có file này
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

// Hàm kiểm tra trễ giờ
const checkIsLate = (timeLabel, bufferMinutes = 0, isDone = false) => {
  if (isDone || !timeLabel) return false;

  const now = new Date();
  const [hours, minutes] = timeLabel.split(':').map(Number);

  // Tạo đối tượng Date cho mốc thời gian của task hôm nay
  const deadline = new Date();
  deadline.setHours(hours, minutes + (parseInt(bufferMinutes) || 0), 0, 0);

  // Nếu hiện tại lớn hơn deadline thì là trễ
  return now > deadline;
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
        (err) => reject(new Error("Không thể lấy vị trí. Hãy bật GPS.")),
        options
      );
    }
  });
};

// --- COMPONENTS ---

// 1. Component Quản lý Công việc (ADMIN) - Đã sửa lỗi Scroll và Sắp xếp
const AdminTaskManager = ({ allTasks, roles, onRefresh, setNotify }) => {
  const [editing, setEditing] = useState({
    id: null,
    role: '',
    title: '',
    time_label: '',
    late_buffer: 15,
    require_input: false,
    require_image: false,
    sort_order: 1
  });

  useEffect(() => {
    if (roles.length > 0 && !editing.role) {
      setEditing(prev => ({ ...prev, role: roles[0].code }));
    }
  }, [roles]);

  const resetForm = () => {
    setEditing({
      id: null,
      role: roles[0]?.code || '',
      title: '',
      time_label: '',
      late_buffer: 15,
      require_input: false,
      require_image: false,
      sort_order: 1
    });
  };

  const handleEdit = (task) => {
    setEditing({ ...task });
    // FIX: Cuộn lên đầu trang để thấy form sửa
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const formElement = document.getElementById('task-form-container');
    if(formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveTask = async () => {
    if (!editing.title) return setNotify("Chưa nhập tên việc!", "error");

    const payload = {
      role: editing.role,
      title: editing.title,
      time_label: editing.time_label,
      late_buffer: parseInt(editing.late_buffer) || 0,
      require_input: editing.require_input,
      require_image: editing.require_image
    };

    try {
      if (editing.id) {
        const { error } = await supabase.from('task_definitions').update(payload).eq('id', editing.id);
        if (error) throw error;
        setNotify("Đã cập nhật công việc!");
      } else {
        const currentTasks = allTasks.filter(t => t.role === editing.role);
        const maxOrder = currentTasks.length > 0 ? Math.max(...currentTasks.map(t => t.sort_order)) : 0;

        const { error } = await supabase.from('task_definitions').insert({ ...payload, sort_order: maxOrder + 1 });
        if (error) throw error;
        setNotify("Đã thêm công việc mới!");
      }
      onRefresh();
      resetForm();
    } catch (err) {
      setNotify("Lỗi: " + err.message, "error");
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm("Bạn chắc chắn muốn xóa việc này?")) return;
    const { error } = await supabase.from('task_definitions').delete().eq('id', id);
    if (!error) {
      setNotify("Đã xóa!");
      onRefresh();
    } else {
      setNotify("Lỗi xóa", "error");
    }
  };

  // FIX: Chức năng sắp xếp
  const handleMove = async (task, direction) => {
    const roleTasks = allTasks
      .filter(t => t.role === task.role)
      .sort((a, b) => a.sort_order - b.sort_order);

    const index = roleTasks.findIndex(t => t.id === task.id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === roleTasks.length - 1)) return;

    const swapTask = direction === 'up' ? roleTasks[index - 1] : roleTasks[index + 1];

    try {
      await supabase.from('task_definitions').update({ sort_order: swapTask.sort_order }).eq('id', task.id);
      await supabase.from('task_definitions').update({ sort_order: task.sort_order }).eq('id', swapTask.id);
      onRefresh();
    } catch (err) {
      setNotify("Lỗi sắp xếp", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div id="task-form-container" className="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
        <h3 className="font-bold text-indigo-900 mb-4 border-b border-indigo-200 pb-2">
          {editing.id ? `Đang sửa: ${editing.title}` : 'Thêm Công Việc Mới'}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs font-bold text-indigo-800 block mb-1">Khu vực</label>
            <select
              className="w-full p-2.5 rounded-lg border border-indigo-200 text-sm"
              value={editing.role}
              onChange={e => setEditing({ ...editing, role: e.target.value })}
              disabled={!!editing.id}
            >
              {roles.map(r => (<option key={r.code} value={r.code}>{r.name}</option>))}
            </select>
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="text-xs font-bold text-indigo-800 block mb-1">Tên công việc</label>
            <input
              className="w-full p-2.5 rounded-lg border border-indigo-200 text-sm"
              placeholder="VD: Kiểm tra nhiệt độ"
              value={editing.title}
              onChange={e => setEditing({ ...editing, title: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs font-bold text-indigo-800 block mb-1">Giờ (VD: 15:30)</label>
            <input
              className="w-full p-2.5 rounded-lg border border-indigo-200 text-sm text-center"
              placeholder="--:--"
              value={editing.time_label}
              onChange={e => setEditing({ ...editing, time_label: e.target.value })}
            />
          </div>
          <div className="col-span-1">
            <label className="text-xs font-bold text-indigo-800 block mb-1">Cho trễ (phút)</label>
            <input
              type="number"
              className="w-full p-2.5 rounded-lg border border-indigo-200 text-sm text-center"
              placeholder="15"
              value={editing.late_buffer}
              onChange={e => setEditing({ ...editing, late_buffer: e.target.value })}
            />
          </div>
          <div className="col-span-2 flex gap-6 items-center">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={editing.require_input} onChange={e => setEditing({ ...editing, require_input: e.target.checked })} />
              Nhập số liệu
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={editing.require_image} onChange={e => setEditing({ ...editing, require_image: e.target.checked })} />
              Bắt chụp ảnh
            </label>
          </div>
          <div className="col-span-2 md:col-span-4 flex justify-end gap-3 pt-2">
            {editing.id && (
              <button onClick={resetForm} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm">Hủy</button>
            )}
            <button onClick={handleSaveTask} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm flex items-center gap-2">
              {editing.id ? <Edit3 size={16} /> : <Plus size={16} />}
              {editing.id ? 'Cập Nhật' : 'Thêm Mới'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {roles.map(role => {
          const tasks = allTasks
            .filter(t => t.role === role.code)
            .sort((a, b) => a.sort_order - b.sort_order);

          if (tasks.length === 0) return null;

          return (
            <div key={role.code} className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between">
                <h3 className="font-bold text-slate-700">{role.name}</h3>
                <span className="text-xs bg-white border px-2 py-1 rounded text-slate-400">{role.code}</span>
              </div>
              <div className="divide-y divide-slate-50">
                {tasks.map((t, idx) => (
                  <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleMove(t, 'up')}
                          disabled={idx === 0}
                          className="text-slate-300 hover:text-blue-600 disabled:opacity-0"
                        >
                          <ArrowUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMove(t, 'down')}
                          disabled={idx === tasks.length - 1}
                          className="text-slate-300 hover:text-blue-600 disabled:opacity-0"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{t.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                                {t.time_label || 'Tự do'} (+{t.late_buffer}p)
                            </span>
                            {t.require_input && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 rounded">SỐ LIỆU</span>}
                            {t.require_image && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 rounded">ẢNH</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(t)} className="p-2 text-blue-500 hover:bg-blue-50 rounded"><Edit3 size={18} /></button>
                      <button onClick={() => handleDeleteTask(t.id)} className="p-2 text-red-400 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 2. Component Nhân Viên (STAFF) - Đã thêm cảnh báo nhấp nháy
const StaffDashboard = ({ user, tasks, reportData, onUpdateLocal, setNotify }) => {
    const [attendance, setAttendance] = useState({ in: null, out: null });
    const [loadingSend, setLoadingSend] = useState(null);
    const [attLoading, setAttLoading] = useState(false);
    // State để trigger render lại mỗi phút cho đồng hồ cảnh báo
    const [, setTick] = useState(0);

    useEffect(() => {
        checkAttendanceStatus();
        // Tạo timer để cập nhật trạng thái trễ giờ mỗi phút
        const timer = setInterval(() => setTick(t => t + 1), 60000);
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
              user_id: user.id, action_type: type, report_date: getTodayISO(),
              image_url: publicUrl, lat: location.lat, lng: location.lng
          });
          if (error) throw error;
          setNotify(`Đã ${type === 'check_in' ? 'Check-in' : 'Check-out'} thành công!`);
          checkAttendanceStatus();
       } catch (err) {
          console.error(err);
          setNotify(err.message || "Lỗi GPS/Mạng", "error");
       } finally { setAttLoading(false); }
    };

    const handleTaskAction = (taskDefId, actionType, value) => {
       const currentTaskData = reportData[taskDefId] || {};
       if (currentTaskData.sent) return;
       let updatedItem = { ...currentTaskData };
       if (actionType === 'toggle') {
          const isDone = !updatedItem.done;
          updatedItem = { ...updatedItem, done: isDone, time: isDone ? new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'}) : '' };
       } else if (actionType === 'input') updatedItem.val = value;
       else if (actionType === 'image') updatedItem.imageUrl = value;
       onUpdateLocal({ ...reportData, [taskDefId]: updatedItem });
    };

    const sendSingleTask = async (taskDefId) => {
       const item = reportData[taskDefId];
       if(!item || !item.done) return setNotify("Chưa hoàn thành!", "error");
       const taskDef = tasks.find(t => t.id === taskDefId);
       if(taskDef?.require_input && !item.val) return setNotify("Thiếu thông tin!", "error");
       if(taskDef?.require_image && !item.imageUrl) return setNotify("Thiếu ảnh!", "error");
       setLoadingSend(taskDefId);
       try {
         item.sent = true;
         const newReportData = { ...reportData, [taskDefId]: item };
         const { error } = await supabase.from('checklist_logs').upsert({ report_date: getTodayISO(), role: user.role, data: newReportData }, { onConflict: 'report_date, role' });
         if(error) throw error;
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

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => reportData[t.id]?.sent).length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    return (
      <div className="space-y-6 pb-20">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <div className="flex justify-between items-end mb-2">
              <span className="font-bold text-slate-700">Tiến độ hôm nay</span>
              <span className="text-blue-600 font-bold text-lg">{progressPercent}%</span>
           </div>
           <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
           <div><h2 className="text-xl font-bold text-slate-800">Chấm công</h2><p className="text-slate-500 text-sm">Chụp ảnh để vào/ra ca</p></div>
           {attLoading ? (
             <div className="flex items-center gap-2 text-blue-600 font-bold bg-blue-50 px-6 py-3 rounded-xl animate-pulse">
               <Loader2 className="animate-spin"/> Đang xử lý GPS...
             </div>
           ) : (
             <div className="flex gap-3">
                <div className="relative">
                   <input type="file" accept="image/*" capture="user" id="att-in" className="hidden" disabled={!!attendance.in} onChange={(e) => handleAttendanceCapture(e, 'check_in')} />
                   <label htmlFor="att-in" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.in ? 'bg-slate-100 text-slate-400 cursor-not-allowed pointer-events-none' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'}`}>
                     <MapPin size={18} /> {attendance.in ? `Vào: ${attendance.in}` : 'Check In'}
                   </label>
                </div>
                <div className="relative">
                   <input type="file" accept="image/*" capture="user" id="att-out" className="hidden" disabled={!attendance.in || !!attendance.out} onChange={(e) => handleAttendanceCapture(e, 'check_out')} />
                   <label htmlFor="att-out" className={`px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer transition-all ${attendance.out ? 'bg-slate-100 text-slate-400 pointer-events-none' : (!attendance.in ? 'opacity-50 cursor-not-allowed' : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100')}`}>
                     <LogOut size={18} /> {attendance.out ? `Ra: ${attendance.out}` : 'Check Out'}
                   </label>
                </div>
             </div>
           )}
        </div>

        <div className="grid gap-4">
          {tasks.map((task) => {
            const item = reportData[task.id] || {};
            const isDone = item.done;
            const isSent = item.sent;
            // FIX: Logic kiểm tra trễ
            const isLate = checkIsLate(task.time_label, task.late_buffer, isDone);

            // FIX: Class động cho trễ giờ (Nhấp nháy đỏ)
            let containerClass = "bg-white p-4 rounded-xl border-2 transition-all ";
            if (isSent) {
                containerClass += "border-emerald-100 bg-emerald-50/30";
            } else if (isLate && !isDone) {
                containerClass += "border-red-500 bg-red-50 shadow-xl shadow-red-200 animate-pulse";
            } else if (isDone) {
                containerClass += "border-blue-200 bg-blue-50/10";
            } else {
                containerClass += "border-transparent shadow-sm";
            }

            return (
               <div key={task.id} className={containerClass}>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                     <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => !isSent && handleTaskAction(task.id, 'toggle')}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDone ? (isSent ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600') : (isLate ? 'bg-red-600 text-white animate-bounce' : 'bg-slate-100 text-slate-300')}`}>
                            {isLate && !isDone ? <AlertTriangle size={18}/> : <CheckCircle2 size={20}/>}
                        </div>
                        <div>
                           <div className="flex items-center gap-2 text-xs mb-1">
                                <span className={`font-bold px-2 py-0.5 rounded ${isLate && !isDone ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {task.time_label || 'Tự do'}
                                    {isLate && !isDone ? ' (TRỄ)' : ''}
                                </span>
                                {item.time && <span className="text-blue-600 font-medium"><Clock size={10} className="inline mr-1"/>{item.time}</span>}
                           </div>
                           <h3 className={`font-semibold ${isLate && !isDone ? 'text-red-700' : 'text-slate-800'}`}>{task.title}</h3>
                        </div>
                     </div>

                     <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center mt-2 md:mt-0 pl-12 md:pl-0">
                        {task.require_input && (
                            <input
                                disabled={!isDone || isSent}
                                value={item.val || ''}
                                onChange={(e) => handleTaskAction(task.id, 'input', e.target.value)}
                                placeholder="Nhập số..."
                                className="w-full sm:w-24 px-3 py-2 text-sm border rounded-lg text-center bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        )}

                        {task.require_image && (
                            <div className="relative">
                                <input type="file" id={`file-${task.id}`} className="hidden" accept="image/*" disabled={!isDone || isSent} onChange={(e) => handleImageUpload(e, task.id)}/>
                                <label htmlFor={`file-${task.id}`} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border cursor-pointer select-none ${!isDone || isSent ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}>
                                    {item.imageUrl ? <span className="text-indigo-600 flex gap-1"><ImageIcon size={16}/>Xem</span> : <span><Camera size={16}/>Ảnh</span>}
                                </label>
                            </div>
                        )}

                        {isDone && !isSent && (
                            <button onClick={() => sendSingleTask(task.id)} disabled={loadingSend === task.id} className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                                {loadingSend === task.id ? <Loader2 className="animate-spin" size={18}/> : <Send size={18}/>}
                            </button>
                        )}

                        {isSent && <span className="text-emerald-600 font-bold text-xs bg-emerald-100 px-3 py-2 rounded-lg border border-emerald-200"><CheckCircle2 size={14} className="inline"/> Đã gửi</span>}
                     </div>
                  </div>
               </div>
            );
          })}
        </div>
      </div>
    );
};

// 3. Admin Employee Manager (Giữ nguyên hoặc đơn giản hóa)
const AdminEmployeeManager = ({ employees, roles, onRefresh, setNotify }) => {
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: '' });

  useEffect(() => {
     if(roles.length > 0 && !newUser.role) setNewUser(prev => ({...prev, role: roles[0].code}));
  }, [roles]);

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.password) return setNotify("Thiếu thông tin đăng nhập", "error");
    try {
      const { error } = await supabase.from('users').insert(newUser);
      if (error) throw error;
      setNotify("Đã thêm nhân viên!");
      setNewUser({ username: '', password: '', full_name: '', role: roles[0]?.code || '' });
      onRefresh();
    } catch (err) { setNotify("Lỗi: " + err.message, "error"); }
  };

  const handleDeleteUser = async (id) => {
    if(!window.confirm("Xóa nhân viên này?")) return;
    try {
        await supabase.from('users').delete().eq('id', id);
        onRefresh(); setNotify("Đã xóa");
    } catch(err) { setNotify("Lỗi xóa", "error"); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-200">
        <h3 className="font-bold text-emerald-900 mb-4">Thêm Nhân Viên</h3>
        <div className="grid grid-cols-2 gap-4">
           <input className="p-2 rounded border" placeholder="Tên đăng nhập" value={newUser.username} onChange={e=>setNewUser({...newUser, username: e.target.value})}/>
           <input className="p-2 rounded border" placeholder="Mật khẩu" value={newUser.password} onChange={e=>setNewUser({...newUser, password: e.target.value})}/>
           <input className="p-2 rounded border" placeholder="Họ và tên" value={newUser.full_name} onChange={e=>setNewUser({...newUser, full_name: e.target.value})}/>
           <select className="p-2 rounded border" value={newUser.role} onChange={e=>setNewUser({...newUser, role: e.target.value})}>
               {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
           </select>
           <button onClick={handleAddUser} className="col-span-2 bg-emerald-600 text-white p-2 rounded font-bold hover:bg-emerald-700">Tạo tài khoản</button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
          {employees.map(emp => (
              <div key={emp.id} className="p-4 border-b last:border-0 flex justify-between items-center hover:bg-slate-50">
                  <div>
                      <p className="font-bold text-slate-800">{emp.full_name}</p>
                      <p className="text-xs text-slate-500">@{emp.username} - {emp.role}</p>
                  </div>
                  <button onClick={() => handleDeleteUser(emp.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
              </div>
          ))}
      </div>
    </div>
  );
};

// 4. Admin Report View (Xem báo cáo)
const AdminReportView = ({ reportData, users, tasks, setNotify }) => {
    const [filterDate, setFilterDate] = useState(getTodayISO());
    const [viewData, setViewData] = useState([]);

    useEffect(() => {
        const fetchReports = async () => {
            const { data } = await supabase.from('checklist_logs').select('*').eq('report_date', filterDate);
            if(data) setViewData(data);
        };
        fetchReports();
    }, [filterDate]);

    // Nhóm báo cáo theo Role -> User
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm border">
                <CalendarClock className="text-blue-600"/>
                <input type="date" className="outline-none font-bold text-slate-700" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            </div>
            {viewData.length === 0 ? <p className="text-center text-slate-400 py-10">Chưa có dữ liệu ngày này</p> : (
                <div className="grid gap-4">
                    {viewData.map(log => {
                        const userRoleName = log.role; // Cần map với tên role nếu có
                        return (
                            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <h3 className="font-bold text-lg text-blue-800 mb-2 border-b pb-2">Khu vực: {userRoleName}</h3>
                                <div className="space-y-2">
                                    {Object.entries(log.data).map(([taskId, val]) => {
                                        if(!val.sent) return null;
                                        const taskInfo = tasks.find(t => t.id == taskId);
                                        return (
                                            <div key={taskId} className="flex justify-between items-start text-sm bg-slate-50 p-2 rounded">
                                                <div>
                                                    <span className="font-bold text-slate-700">{taskInfo?.title || 'Unknown Task'}</span>
                                                    <div className="text-xs text-slate-500 mt-1">
                                                        <Clock size={10} className="inline mr-1"/>{val.time}
                                                        {val.val && <span className="ml-2 px-1 bg-amber-100 text-amber-800 rounded">Giá trị: {val.val}</span>}
                                                    </div>
                                                </div>
                                                {val.imageUrl && (
                                                    <a href={val.imageUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                                                        <ImageIcon size={14}/> Ảnh
                                                    </a>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// --- MAIN APP COMPONENT ---

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ msg: '', type: '' });

  // Login State
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Data State
  const [tasks, setTasks] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [reportData, setReportData] = useState({}); // Local state cho staff

  // Admin Navigation
  const [adminTab, setAdminTab] = useState('tasks'); // tasks, employees, reports

  useEffect(() => {
    const checkSession = async () => {
      const savedUser = localStorage.getItem('checklist_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        setUser(u);
        await loadData(u);
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const loadData = async (currentUser) => {
    if (currentUser.role === 'admin') {
      const [ tRes, rRes, uRes ] = await Promise.all([
        supabase.from('task_definitions').select('*'),
        supabase.from('roles').select('*'),
        supabase.from('users').select('*').neq('role', 'admin')
      ]);
      if (tRes.data) setTasks(tRes.data);
      if (rRes.data) setRoles(rRes.data);
      if (uRes.data) setEmployees(uRes.data);
    } else {
      // Load Tasks cho Staff
      const { data: tData } = await supabase.from('task_definitions').select('*').eq('role', currentUser.role).order('sort_order', { ascending: true });
      if (tData) setTasks(tData);

      // Load Report hôm nay (nếu có để resume)
      const today = getTodayISO();
      const { data: rData } = await supabase.from('checklist_logs').select('data').eq('report_date', today).eq('role', currentUser.role).single();
      if (rData && rData.data) setReportData(rData.data);
    }
  };

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) return showNotify(setNotification, "Vui lòng nhập đủ thông tin", "error");

    setLoading(true);
    try {
      const { data, error } = await supabase.from('users').select('*')
        .eq('username', loginForm.username)
        .eq('password', loginForm.password) // Lưu ý: Thực tế nên hash password
        .single();

      if (error || !data) throw new Error("Sai tên đăng nhập hoặc mật khẩu");

      localStorage.setItem('checklist_user', JSON.stringify(data));
      setUser(data);
      await loadData(data);
      showNotify(setNotification, `Xin chào, ${data.full_name}!`);
    } catch (err) {
      showNotify(setNotification, err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('checklist_user');
    setUser(null);
    setReportData({});
    setTasks([]);
  };

  // --- RENDER ---
  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;

  // Màn hình đăng nhập
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-xl">
           <div className="text-center mb-8">
             <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30">
               <ShieldCheck size={32}/>
             </div>
             <h1 className="text-2xl font-bold text-slate-800">Đăng Nhập Hệ Thống</h1>
           </div>
           <div className="space-y-4">
             <div className="relative">
                <User className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                <input type="text" placeholder="Tên đăng nhập" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})}/>
             </div>
             <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                <input type="password" placeholder="Mật khẩu" className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} onKeyDown={e => e.key === 'Enter' && handleLogin()}/>
             </div>
             {notification.msg && <div className={`text-sm text-center font-medium ${notification.type === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>{notification.msg}</div>}
             <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/30">Đăng Nhập</button>
           </div>
        </div>
      </div>
    );
  }

  // Giao diện chính
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
            <span className="font-bold text-lg hidden sm:block">Checklist App</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold">{user.full_name}</p>
              <p className="text-xs text-slate-500 uppercase">{user.role}</p>
            </div>
            <button onClick={handleLogout} className="p-2 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
              <LogOut size={20}/>
            </button>
          </div>
        </div>
      </header>

      {/* Thông báo nổi */}
      {notification.msg && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-xl shadow-lg border animate-fade-in ${notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
            <span className="font-medium">{notification.msg}</span>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {user.role === 'admin' ? (
          <div className="space-y-6">
             {/* Admin Tabs */}
             <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                <button onClick={() => setAdminTab('tasks')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${adminTab === 'tasks' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                   <ListTodo size={18}/> Quản lý Việc
                </button>
                <button onClick={() => setAdminTab('employees')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${adminTab === 'employees' ? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                   <Users size={18}/> Nhân viên
                </button>
                <button onClick={() => setAdminTab('reports')} className={`flex-1 py-2.5 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${adminTab === 'reports' ? 'bg-amber-50 text-amber-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                   <Briefcase size={18}/> Báo cáo
                </button>
             </div>

             {adminTab === 'tasks' && (
                <AdminTaskManager
                  allTasks={tasks}
                  roles={roles}
                  onRefresh={() => loadData(user)}
                  setNotify={(msg, type) => showNotify(setNotification, msg, type)}
                />
             )}
             {adminTab === 'employees' && (
                <AdminEmployeeManager
                   employees={employees}
                   roles={roles}
                   onRefresh={() => loadData(user)}
                   setNotify={(msg, type) => showNotify(setNotification, msg, type)}
                />
             )}
             {adminTab === 'reports' && (
                <AdminReportView
                   reportData={reportData}
                   users={employees}
                   tasks={tasks}
                   setNotify={(msg, type) => showNotify(setNotification, msg, type)}
                />
             )}
          </div>
        ) : (
          <StaffDashboard
            user={user}
            tasks={tasks}
            reportData={reportData}
            onUpdateLocal={setReportData}
            setNotify={(msg, type) => showNotify(setNotification, msg, type)}
          />
        )}
      </main>
    </div>
  );
};

export default App;