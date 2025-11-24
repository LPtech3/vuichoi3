import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  User, Lock, LogOut, RefreshCcw, Camera, Trash2, Plus,
  CheckCircle2, Clock, Send, Loader2,
  LayoutDashboard, Menu, X, ShieldCheck,
  Users, ListTodo, Image as ImageIcon, MapPin, Briefcase,
  CalendarClock, AlertTriangle, AlertCircle, ExternalLink,
  Edit3, ArrowUp, ArrowDown, Copy, Key, Save, XCircle, Home
} from 'lucide-react';

// --- STYLES CHO HIỆU ỨNG NHẤP NHÁY ---
const CustomStyles = () => (
  <style>{`
    @keyframes blink-red {
      0%, 100% { background-color: #fff; border-color: #ef4444; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      50% { background-color: #fef2f2; border-color: #b91c1c; box-shadow: 0 0 10px 2px rgba(239, 68, 68, 0.3); }
    }
    .urgent-blink {
      animation: blink-red 1.5s infinite;
      border-width: 2px;
    }
    .animate-bounce-short {
      animation: bounce 0.5s 1;
    }
  `}</style>
);

// --- UTILS ---
const getTodayISO = () => new Date().toISOString().split('T')[0];

const getCurrentTime = () => {
    const now = new Date();
    return now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
};

const checkIsLate = (taskTime, lateBuffer, sentTime) => {
    if (sentTime) return false; // Nếu đã gửi thì không tính trễ
    if (!taskTime) return false;

    const [taskH, taskM] = taskTime.split(':').map(Number);
    const now = new Date();
    const taskDate = new Date();
    taskDate.setHours(taskH, taskM, 0, 0);

    const lateLimit = new Date(taskDate.getTime() + lateBuffer * 60000); // Thêm buffer (phút)

    return now > lateLimit;
};

// ==========================================
// THÔNG BÁO CHUNG
// ==========================================
const Notification = ({ notification }) => {
    if (!notification.msg) return null;
    const isError = notification.type === 'error';
    const bgColor = isError ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700';
    const Icon = isError ? AlertCircle : CheckCircle2;
    return (
        <div className={`fixed top-4 right-4 z-[100] p-4 rounded-lg shadow-xl border flex items-center gap-3 ${bgColor} animate-bounce-short`}>
            <Icon size={20} />
            <span className="font-medium">{notification.msg}</span>
        </div>
    );
};

// ==========================================
// ĐĂNG NHẬP (MODERN LOGIN)
// ==========================================
const ModernLogin = ({ onLogin, setNotify }) => {
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({ msg: '', type: '' });

    const handleLogin = async () => {
        if (!loginForm.username || !loginForm.password) {
            setNotification({ msg: "Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu.", type: 'error' });
            return;
        }

        setLoading(true);
        setNotification({ msg: '', type: '' });

        const { data: userData, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', loginForm.username)
            .eq('password', loginForm.password)
            .single();

        setLoading(false);

        if (error || !userData) {
            setNotification({ msg: "Sai Tên đăng nhập hoặc Mật khẩu.", type: 'error' });
            return;
        }

        onLogin(userData);
        setNotify("Đăng nhập thành công!", "success");
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-2xl border border-slate-200">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-500/30">
                        <ShieldCheck size={32}/>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Đăng Nhập Hệ Thống</h1>
                </div>
                <div className="space-y-4">
                    <div className="relative">
                        <User className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                        <input
                            type="text"
                            placeholder="Tên đăng nhập"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={loginForm.username}
                            onChange={e => setLoginForm({...loginForm, username: e.target.value})}
                        />
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                        <input
                            type="password"
                            placeholder="Mật khẩu"
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={loginForm.password}
                            onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        />
                    </div>
                    {notification.msg && <div className="text-red-500 text-sm text-center font-medium">{notification.msg}</div>}
                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full py-3 mt-6 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20}/> : 'Đăng Nhập'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// GIAO DIỆN CHẤM CÔNG VÀ LÀM VIỆC (USER)
// ==========================================
const UserDashboard = ({ user, tasks, reports, onLogout, onRefresh, setNotify, roles }) => {
    const today = getTodayISO();
    const userTasks = tasks.filter(t => t.role === user.role);
    const todayReport = reports.find(r => r.report_date === today && r.user_id === user.id) || null;
    const initialReportData = todayReport ? todayReport.data : {};

    // Sắp xếp các task theo time_label (giờ)
    const sortedTasks = [...userTasks].sort((a, b) => {
        if (!a.time_label) return 1;
        if (!b.time_label) return -1;
        return a.time_label.localeCompare(b.time_label) || a.sort_order - b.sort_order;
    });

    const [reportData, setReportData] = useState(initialReportData);
    const [loading, setLoading] = useState(false);
    const [fileToUpload, setFileToUpload] = useState(null);
    const [uploadingTaskId, setUploadingTaskId] = useState(null);

    useEffect(() => {
        setReportData(initialReportData);
    }, [todayReport, tasks]);

    const handleInput = (taskId, key, value) => {
        setReportData(prev => ({
            ...prev,
            [taskId]: {
                ...prev[taskId],
                [key]: value,
                done: true,
                sent: false, // đánh dấu chưa gửi chính thức
                time: getCurrentTime()
            }
        }));
    };

    const handleUploadImage = async (taskId) => {
        if (!fileToUpload) return setNotify("Vui lòng chọn ảnh", "error");
        setUploadingTaskId(taskId);
        setLoading(true);

        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${user.id}_${taskId}_${Date.now()}.${fileExt}`;
        const filePath = `reports/${today}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(filePath, fileToUpload);

        if (uploadError) {
            setLoading(false);
            setUploadingTaskId(null);
            setNotify("Lỗi tải ảnh lên: " + uploadError.message, "error");
            return;
        }

        const { data: publicUrlData } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

        handleInput(taskId, 'imageUrl', publicUrlData.publicUrl);
        setFileToUpload(null);
        setUploadingTaskId(null);
        setLoading(false);
        setNotify("Tải ảnh thành công!", "success");
    };

    const handleSaveReport = async (isFinalSubmit = false) => {
        setLoading(true);
        const report = {
            report_date: today,
            user_id: user.id,
            role: user.role,
            data: reportData
        };

        let result;
        if (todayReport) {
            result = await supabase
                .from('checklist_logs')
                .update({ data: reportData, is_submitted: isFinalSubmit, updated_at: new Date() })
                .eq('id', todayReport.id);
        } else {
            result = await supabase
                .from('checklist_logs')
                .insert([{ ...report, is_submitted: isFinalSubmit }]);
        }

        setLoading(false);

        if (result.error) {
            setNotify("Lỗi lưu báo cáo: " + result.error.message, "error");
        } else {
            setNotify(isFinalSubmit ? "Gửi báo cáo thành công!" : "Lưu nháp thành công!", "success");
            onRefresh(); // Tải lại dữ liệu sau khi lưu
        }
    };

    // Lấy tên khu vực
    const roleName = roles.find(r => r.code === user.role)?.name || user.role;

    const submittedCount = Object.values(reportData).filter(i => i.sent).length;
    const totalCount = sortedTasks.length;
    const isAllSubmitted = totalCount > 0 && submittedCount === totalCount;

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 sticky top-0 bg-white z-10 p-4 -mx-4 -mt-4 md:p-8 md:-mx-8">
                <div className="flex items-center gap-3">
                    <Home size={24} className="text-blue-600"/>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold text-slate-800">{roleName}</h1>
                        <p className="text-sm text-slate-500 flex items-center gap-2"><User size={14}/>{user.name} ({user.role})</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onRefresh} className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-full bg-slate-100"><RefreshCcw size={18}/></button>
                    <button onClick={onLogout} className="flex items-center gap-2 p-2 px-3 bg-red-100 text-red-600 rounded-full font-medium text-sm hover:bg-red-200 transition-colors"><LogOut size={16}/><span className="hidden sm:inline">Thoát</span></button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 space-y-4">
                <h2 className="text-xl font-bold text-slate-800">Tiến độ hôm nay ({today})</h2>
                <div className="flex items-center gap-4 text-sm font-medium">
                    <span className="text-slate-600">Đã hoàn thành:</span>
                    <span className={`font-bold ${submittedCount === totalCount ? 'text-emerald-600' : 'text-orange-500'}`}>
                        {submittedCount} / {totalCount}
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${totalCount > 0 ? (submittedCount / totalCount) * 100 : 0}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {sortedTasks.map(task => {
                    const taskData = reportData[task.id] || {};
                    const isDone = !!taskData.done;
                    const isSent = !!taskData.sent;
                    const isLate = checkIsLate(task.time_label, task.late_buffer, taskData.sent);
                    const isUrgent = isLate && !isSent;

                    return (
                        <div
                            key={task.id}
                            className={`p-4 rounded-xl shadow border transition-all ${isSent ? 'bg-emerald-50 border-emerald-300' : isUrgent ? 'urgent-blink' : 'bg-white border-slate-200'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <Clock size={16} className="text-blue-600"/>
                                        {task.time_label || 'Không giờ'}
                                        {task.time_label && <span className="text-xs text-slate-400 font-normal">(+{task.late_buffer}p)</span>}
                                        {isUrgent && <span className="text-red-600 text-xs font-bold flex items-center gap-1"><AlertTriangle size={14}/> TRỄ</span>}
                                    </p>
                                    <h3 className={`text-lg font-bold ${isSent ? 'text-emerald-800' : 'text-slate-900'}`}>{task.title}</h3>
                                    {isSent && <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                                        <CheckCircle2 size={14}/> Đã gửi báo cáo lúc: {taskData.time}
                                    </p>}
                                    {taskData.time && !isSent && <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
                                        <Save size={14}/> Đã lưu nháp lúc: {taskData.time}
                                    </p>}
                                </div>

                                {isSent && <CheckCircle2 size={30} className="text-emerald-500 flex-shrink-0"/>}
                            </div>

                            {!isSent && (
                                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                                    {task.require_input && (
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Nhập giá trị/ghi chú báo cáo..."
                                                className="w-full p-3 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                                value={taskData.val || ''}
                                                onChange={e => handleInput(task.id, 'val', e.target.value)}
                                            />
                                            {taskData.val && <XCircle size={18} className="absolute right-3 top-3 text-slate-400 hover:text-red-500 cursor-pointer" onClick={() => handleInput(task.id, 'val', '')}/>}
                                        </div>
                                    )}

                                    {task.require_image && (
                                        <div className="flex gap-3 items-center">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={e => setFileToUpload(e.target.files[0])}
                                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                            />
                                            <button
                                                onClick={() => handleUploadImage(task.id)}
                                                disabled={loading || uploadingTaskId === task.id || !fileToUpload}
                                                className={`px-4 py-2 text-sm rounded-lg font-bold transition-colors flex items-center gap-2 flex-shrink-0 ${uploadingTaskId === task.id ? 'bg-amber-500' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                                            >
                                                {uploadingTaskId === task.id ? <Loader2 className="animate-spin" size={18}/> : <Camera size={18}/>}
                                                {uploadingTaskId === task.id ? 'Đang Tải...' : 'Tải Ảnh'}
                                            </button>
                                        </div>
                                    )}

                                    {taskData.imageUrl && (
                                        <div className="mt-2 text-xs text-green-600 font-medium flex items-center gap-2">
                                            <ImageIcon size={14}/> Ảnh đã tải lên: <a href={taskData.imageUrl} target="_blank" rel="noreferrer" className="underline hover:text-blue-500 truncate">{taskData.imageUrl.substring(0, 50)}...</a>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => handleInput(task.id, 'sent', true)}
                                        disabled={loading || (task.require_input && !taskData.val) || (task.require_image && !taskData.imageUrl)}
                                        className="w-full py-3 mt-4 bg-emerald-600 text-white rounded-lg font-bold text-md hover:bg-emerald-700 transition-colors disabled:bg-slate-400 flex items-center justify-center gap-2"
                                    >
                                        <Send size={18}/> BÁO CÁO HOÀN THÀNH
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex justify-center mt-6 p-4 border-t border-slate-200">
                <button
                    onClick={() => handleSaveReport(false)}
                    disabled={loading || isAllSubmitted}
                    className="px-6 py-3 bg-blue-100 text-blue-700 rounded-full font-bold text-sm hover:bg-blue-200 transition-colors disabled:bg-slate-200 disabled:text-slate-500 flex items-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                    {isAllSubmitted ? 'Đã hoàn thành tất cả' : 'Lưu Nháp Toàn Bộ'}
                </button>
            </div>
        </div>
    );
};


// ==========================================
// QUẢN LÝ KHU VỰC/VỊ TRÍ (ROLE MANAGER)
// ==========================================
const AdminRoleManager = ({ roles, allTasks, onRefresh, setNotify }) => {
    const [editing, setEditing] = useState({ id: null, name: '', code: '' });
    const [loading, setLoading] = useState(false);

    const handleEdit = (role) => setEditing({ ...role });
    const handleNew = () => setEditing({ id: null, name: '', code: '' });

    const handleSaveRole = async () => {
        if (!editing.name || !editing.code) return setNotify("Chưa nhập Tên hoặc Mã khu vực", "error");

        setLoading(true);
        const payload = { name: editing.name, code: editing.code.toUpperCase().trim() };

        let result;
        if (editing.id) {
            result = await supabase.from('job_roles').update(payload).eq('id', editing.id);
        } else {
            result = await supabase.from('job_roles').insert([payload]);
        }

        setLoading(false);
        if (result.error) {
            setNotify("Lỗi lưu Khu vực: " + result.error.message, "error");
        } else {
            setNotify("Lưu Khu vực thành công!", "success");
            onRefresh();
            handleNew();
        }
    };

    const handleDeleteRole = async (id, code) => {
        const tasksCount = allTasks.filter(t => t.role === code).length;
        if (tasksCount > 0) {
            setNotify(`Không thể xóa. Khu vực này có ${tasksCount} công việc đang hoạt động.`, "error");
            return;
        }

        if (window.confirm("Bạn có chắc chắn muốn xóa khu vực này?")) {
            setLoading(true);
            const { error } = await supabase.from('job_roles').delete().eq('id', id);
            setLoading(false);
            if (error) {
                setNotify("Lỗi xóa: " + error.message, "error");
            } else {
                setNotify("Xóa khu vực thành công!", "success");
                onRefresh();
            }
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-xl shadow border border-slate-200">
                <h3 className="text-lg font-bold mb-4 text-slate-800 flex justify-between items-center">
                    Danh Sách Khu Vực
                </h3>
                <div className="space-y-2">
                    {roles.map(r => (
                        <div key={r.id} className={`p-3 border rounded-lg flex items-center justify-between hover:bg-slate-50 ${editing.id === r.id ? 'bg-blue-50 border-blue-200' : 'border-slate-100'}`}>
                            <div>
                                <p className="font-bold text-sm text-slate-700">{r.name}</p>
                                <p className="text-xs text-slate-400">{r.code} ({allTasks.filter(t => t.role === r.code).length} việc)</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(r)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit3 size={16}/></button>
                                <button onClick={() => handleDeleteRole(r.id, r.code)} disabled={loading} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
                <h3 className="text-lg font-bold mb-4 text-slate-800">
                    {editing.id ? 'Chỉnh Sửa Khu Vực' : 'Thêm Khu Vực Mới'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tên Khu Vực</label>
                        <input type="text" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm" placeholder="Ví dụ: Cửa hàng 1"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mã Khu Vực (Viết tắt, không dấu)</label>
                        <input type="text" value={editing.code} onChange={e => setEditing({...editing, code: e.target.value.toUpperCase().trim()})} className="w-full p-2 border rounded-lg text-sm" placeholder="Ví dụ: CH1"/>
                    </div>
                    <button onClick={handleSaveRole} disabled={loading} className="w-full py-2 mt-4 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        {editing.id ? 'Lưu Thay Đổi' : 'Thêm Khu Vực'}
                    </button>
                    {editing.id && (
                        <button onClick={handleNew} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-200">
                            Thêm Mới Khác
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// QUẢN LÝ CÔNG VIỆC (TASK MANAGER)
// [Đã cập nhật: Sắp xếp theo time_label, loại bỏ nút Lên/Xuống]
// ==========================================
const AdminTaskManager = ({ allTasks, roles, onRefresh, setNotify }) => {
    const [editing, setEditing] = useState({
        id: null,
        role: roles.length > 0 ? roles[0].code : '',
        title: '',
        time_label: '',
        late_buffer: 15,
        require_input: false,
        require_image: false,
        sort_order: 1
    });
    const formRef = useRef(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!editing.id && roles.length > 0 && !editing.role) {
            setEditing(prev => ({ ...prev, role: roles[0].code }));
        }
    }, [roles]);

    const tasks = allTasks.filter(t => t.role === editing.role).sort((a, b) => {
        if (!a.time_label) return 1;
        if (!b.time_label) return -1;
        return a.time_label.localeCompare(b.time_label) || a.sort_order - b.sort_order;
    });

    const handleEdit = (task) => {
        setEditing({ ...task });
        formRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleNew = () => {
        setEditing({
            id: null,
            role: editing.role,
            title: '',
            time_label: '',
            late_buffer: 15,
            require_input: false,
            require_image: false,
            sort_order: (tasks.length > 0 ? tasks[tasks.length - 1].sort_order : 0) + 1
        });
    };

    const handleSaveTask = async () => {
        if (!editing.title || !editing.role) return setNotify("Chưa nhập Tên việc hoặc Khu vực", "error");

        setLoading(true);
        const payload = {
            role: editing.role,
            title: editing.title,
            time_label: editing.time_label || null,
            late_buffer: editing.late_buffer,
            require_input: editing.require_input,
            require_image: editing.require_image,
            sort_order: editing.sort_order // Dùng cho sắp xếp phụ
        };

        let result;
        if (editing.id) {
            result = await supabase.from('task_definitions').update(payload).eq('id', editing.id);
        } else {
            result = await supabase.from('task_definitions').insert([payload]);
        }

        setLoading(false);
        if (result.error) {
            setNotify("Lỗi lưu công việc: " + result.error.message, "error");
        } else {
            setNotify("Lưu công việc thành công!", "success");
            onRefresh();
            handleNew();
        }
    };

    const handleDeleteTask = async (id) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa công việc này?")) {
            setLoading(true);
            const { error } = await supabase.from('task_definitions').delete().eq('id', id);
            setLoading(false);
            if (error) {
                setNotify("Lỗi xóa: " + error.message, "error");
            } else {
                setNotify("Xóa công việc thành công!", "success");
                onRefresh();
                handleNew();
            }
        }
    };

    // Loại bỏ hoàn toàn hàm handleMove

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-xl shadow border border-slate-200">
                <h3 className="text-lg font-bold mb-4 text-slate-800">
                    Danh Sách Công Việc
                </h3>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Chọn Khu Vực</label>
                    <select value={editing.role} onChange={e => setEditing(prev => ({ ...prev, role: e.target.value, id: null }))} className="w-full p-2 border rounded-lg text-sm bg-white">
                        {roles.map(r => (
                            <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {tasks.map((t, idx) => (
                        <div key={t.id} className={`p-3 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50 ${editing.id === t.id ? 'bg-orange-50' : ''}`}>
                            <div className="flex items-center gap-3">
                                {/* Loại bỏ nút Lên/Xuống */}
                                <div>
                                    <p className="font-bold text-sm text-slate-700">{t.title}</p>
                                    <p className="text-xs text-slate-400">
                                        {t.time_label ? `⏰ ${t.time_label}` : 'Không giờ'} (+{t.late_buffer}p)
                                        {t.require_input && ' • 🔢 Nhập số'}
                                        {t.require_image && ' • 📸 Chụp ảnh'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(t)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit3 size={16}/></button>
                                <button onClick={() => handleDeleteTask(t.id)} disabled={loading} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-slate-200 sticky top-4" ref={formRef}>
                <h3 className="text-lg font-bold mb-4 text-slate-800">
                    {editing.id ? 'Chỉnh Sửa Công Việc' : 'Thêm Công Việc Mới'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tên Công Việc</label>
                        <input type="text" value={editing.title} onChange={e => setEditing({...editing, title: e.target.value})} className="w-full p-2 border rounded-lg text-sm" placeholder="Ví dụ: Dọn dẹp quầy kệ"/>
                    </div>
                    <div className="flex gap-2">
                        <div className="w-1/2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Giờ Báo Cáo (HH:MM)</label>
                            <input type="time" value={editing.time_label || ''} onChange={e => setEditing({...editing, time_label: e.target.value})} className="w-full p-2 border rounded-lg text-sm" />
                        </div>
                        <div className="w-1/2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Đệm Trễ (Phút)</label>
                            <input type="number" value={editing.late_buffer} onChange={e => setEditing({...editing, late_buffer: parseInt(e.target.value) || 0})} className="w-full p-2 border rounded-lg text-sm" />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <label className="flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                            <input type="checkbox" checked={editing.require_input} onChange={e => setEditing({...editing, require_input: e.target.checked})} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded"/>
                            Yêu cầu nhập số/ghi chú
                        </label>
                        <label className="flex items-center text-sm font-medium text-slate-700 cursor-pointer">
                            <input type="checkbox" checked={editing.require_image} onChange={e => setEditing({...editing, require_image: e.target.checked})} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded"/>
                            Yêu cầu chụp ảnh
                        </label>
                    </div>
                    <button onClick={handleSaveTask} disabled={loading} className="w-full py-2 mt-4 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        {editing.id ? 'Lưu Thay Đổi' : 'Thêm Công Việc'}
                    </button>
                    {editing.id && (
                        <button onClick={handleNew} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-200">
                            Thêm Mới Khác
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


// ==========================================
// QUẢN LÝ NGƯỜI DÙNG (USER MANAGER)
// ==========================================
const AdminUserManager = ({ users, roles, onRefresh, setNotify }) => {
    const [editing, setEditing] = useState({ id: null, username: '', password: '', name: '', role: roles.length > 0 ? roles[0].code : '' });
    const [loading, setLoading] = useState(false);
    const formRef = useRef(null);

    useEffect(() => {
        if (!editing.id && roles.length > 0 && !editing.role) {
            setEditing(prev => ({ ...prev, role: roles[0].code }));
        }
    }, [roles]);

    const handleEdit = (user) => {
        setEditing({ ...user, password: '' });
        formRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleNew = () => {
        setEditing({ id: null, username: '', password: '', name: '', role: editing.role });
    };

    const handleSaveUser = async () => {
        if (!editing.username || !editing.name || (!editing.id && !editing.password)) {
            return setNotify("Vui lòng nhập đầy đủ Tên, Tên đăng nhập và Mật khẩu (khi thêm mới).", "error");
        }

        setLoading(true);
        const payload = {
            username: editing.username,
            name: editing.name,
            role: editing.role
        };
        if (editing.password) {
            payload.password = editing.password;
        }

        let result;
        if (editing.id) {
            result = await supabase.from('app_users').update(payload).eq('id', editing.id);
        } else {
            result = await supabase.from('app_users').insert([payload]);
        }

        setLoading(false);
        if (result.error) {
            setNotify("Lỗi lưu người dùng: " + result.error.message, "error");
        } else {
            setNotify("Lưu người dùng thành công!", "success");
            onRefresh();
            handleNew();
        }
    };

    const handleDeleteUser = async (id) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa người dùng này?")) {
            setLoading(true);
            const { error } = await supabase.from('app_users').delete().eq('id', id);
            setLoading(false);
            if (error) {
                setNotify("Lỗi xóa: " + error.message, "error");
            } else {
                setNotify("Xóa người dùng thành công!", "success");
                onRefresh();
            }
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white p-6 rounded-xl shadow border border-slate-200">
                <h3 className="text-lg font-bold mb-4 text-slate-800">Danh Sách Nhân Sự</h3>
                <div className="space-y-2">
                    {users.map(u => (
                        <div key={u.id} className={`p-3 border rounded-lg flex items-center justify-between hover:bg-slate-50 ${editing.id === u.id ? 'bg-blue-50 border-blue-200' : 'border-slate-100'}`}>
                            <div>
                                <p className="font-bold text-sm text-slate-700">{u.name}</p>
                                <p className="text-xs text-slate-400">@{u.username} • Khu vực: {u.role}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(u)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"><Edit3 size={16}/></button>
                                <button onClick={() => handleDeleteUser(u.id)} disabled={loading} className="p-2 text-red-600 hover:bg-red-100 rounded-full"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-slate-200 sticky top-4" ref={formRef}>
                <h3 className="text-lg font-bold mb-4 text-slate-800">
                    {editing.id ? 'Chỉnh Sửa Người Dùng' : 'Thêm Người Dùng Mới'}
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tên Hiển Thị</label>
                        <input type="text" value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="w-full p-2 border rounded-lg text-sm" placeholder="Ví dụ: Nguyễn Văn A"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tên Đăng Nhập</label>
                        <input type="text" value={editing.username} onChange={e => setEditing({...editing, username: e.target.value})} className="w-full p-2 border rounded-lg text-sm" placeholder="Ví dụ: vana"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mật Khẩu {editing.id ? ' (Bỏ trống để giữ nguyên)' : ''}</label>
                        <input type="password" value={editing.password} onChange={e => setEditing({...editing, password: e.target.value})} className="w-full p-2 border rounded-lg text-sm" placeholder="Mật khẩu"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Khu Vực</label>
                        <select value={editing.role} onChange={e => setEditing({...editing, role: e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-white">
                            {roles.map(r => (
                                <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                            ))}
                        </select>
                    </div>
                    <button onClick={handleSaveUser} disabled={loading} className="w-full py-2 mt-4 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>}
                        {editing.id ? 'Lưu Thay Đổi' : 'Thêm Người Dùng'}
                    </button>
                    {editing.id && (
                        <button onClick={handleNew} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg font-medium text-sm hover:bg-slate-200">
                            Thêm Mới Khác
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ==========================================
// TỔNG QUAN HÔM NAY (ADMIN REPORTS)
// ==========================================
const AdminReports = ({ reports, allTasks, roles }) => {
    const today = getTodayISO();
    const todayReports = reports.filter(r => r.report_date === today);

    const roleMap = roles.reduce((acc, r) => ({ ...acc, [r.code]: r.name }), {});

    // Tính toán tiến độ
    const progressData = roles.map(role => {
        const roleReports = todayReports.filter(r => r.role === role.code);
        const roleTasks = allTasks.filter(t => t.role === role.code);
        const totalTasks = roleTasks.length;

        let completedReports = 0;
        let pendingReports = 0;
        let submittedCount = 0;

        roleReports.forEach(r => {
            const tasksSubmitted = Object.values(r.data).filter(item => item.sent).length;
            if (tasksSubmitted === totalTasks && totalTasks > 0) {
                completedReports++;
            } else if (tasksSubmitted > 0) {
                pendingReports++;
            }
            submittedCount += tasksSubmitted;
        });

        const totalUsers = roleReports.length;
        const totalSent = totalTasks * totalUsers;
        const overallPercent = totalSent > 0 ? Math.round((submittedCount / totalSent) * 100) : 0;

        return {
            role: role.code,
            name: role.name,
            totalUsers,
            completedUsers: completedReports,
            pendingUsers: pendingReports,
            overallPercent,
        };
    });

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Tổng Quan Báo Cáo ({today})</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {progressData.map(p => (
                    <div key={p.role} className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-blue-600 flex items-center gap-2"><MapPin size={20}/> {p.name}</h3>
                            <span className={`text-2xl font-extrabold ${p.overallPercent === 100 ? 'text-emerald-600' : 'text-orange-500'}`}>{p.overallPercent}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${p.overallPercent}%` }}></div>
                        </div>
                        <div className="text-sm text-slate-600 pt-2 border-t border-slate-100">
                            <p>Tổng Nhân Sự: <span className="font-bold text-slate-800">{p.totalUsers}</span></p>
                            <p>Hoàn thành (100%): <span className="font-bold text-emerald-600">{p.completedUsers}</span></p>
                            <p>Đang làm: <span className="font-bold text-orange-500">{p.pendingUsers}</span></p>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className="text-lg font-bold text-slate-800 pt-4 border-t border-slate-200">Chi Tiết Báo Cáo Nhân Sự</h3>
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b">
                            <tr>
                                <th className="p-4">Nhân viên</th>
                                <th className="p-4">Khu vực</th>
                                <th className="p-4">Tiến độ</th>
                                <th className="p-4">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {todayReports.map(r => {
                                const roleTasks = allTasks.filter(t => t.role === r.role);
                                const totalTasks = roleTasks.length;
                                const submittedCount = Object.values(r.data).filter(item => item.sent).length;
                                const percent = totalTasks > 0 ? Math.round((submittedCount / totalTasks) * 100) : 0;

                                let statusText = "Đang chờ";
                                let statusColor = "bg-slate-200 text-slate-600";
                                if (percent === 100) {
                                    statusText = "Hoàn thành";
                                    statusColor = "bg-emerald-100 text-emerald-700";
                                } else if (percent > 0) {
                                    statusText = "Đang tiến hành";
                                    statusColor = "bg-yellow-100 text-yellow-700";
                                }

                                return (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-medium">{r.app_users.name}</td>
                                        <td className="p-4">{roleMap[r.role] || r.role}</td>
                                        <td className="p-4 font-bold text-slate-700">{submittedCount}/{totalTasks} ({percent}%)</td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${statusColor}`}>{statusText}</span>
                                        </td>
                                    </tr>
                                )
                            })}
                            {todayReports.length === 0 && (
                                <tr><td colSpan="4" className="p-4 text-center text-slate-500">Chưa có báo cáo nào hôm nay</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ==========================================
// TỔNG QUAN CHẤM CÔNG (ADMIN TIMESHEET)
// ==========================================
const AdminTimesheet = ({ timeLogs, users }) => {
    // Logic cho AdminTimesheet (hiển thị logs, vị trí, etc.)
    // Phần này yêu cầu cột vị trí (location) trong timeLogs.

    // Tạm thời hiển thị danh sách log
    const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {});

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Lịch Sử Chấm Công & Định Vị</h2>
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b">
                            <tr>
                                <th className="p-4">Thời gian</th>
                                <th className="p-4">Nhân viên</th>
                                <th className="p-4">Thao tác</th>
                                <th className="p-4">Vị trí (nếu có)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {timeLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                                    <td className="p-4 font-medium">{userMap[log.user_id] || log.user_id}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${log.type === 'check_in' ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'}`}>
                                            {log.type === 'check_in' ? 'Check In' : 'Check Out'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {log.location ?
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${log.location.lat},${log.location.lng}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                                <MapPin size={16}/> Xem Bản Đồ
                                            </a>
                                            : "Không có dữ liệu vị trí"}
                                    </td>
                                </tr>
                            ))}
                            {timeLogs.length === 0 && (
                                <tr><td colSpan="4" className="p-4 text-center text-slate-500">Chưa có dữ liệu chấm công nào</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};


// ==========================================
// LỊCH SỬ BÁO CÁO (CHUYÊN NGHIỆP) [THÊM MỚI]
// ==========================================
const AdminReportHistory = ({ allTasks, roles, users, setNotify }) => {
    const [filter, setFilter] = useState({ date: getTodayISO(), user_id: '', role: '' });
    const [logs, setLogs] = useState([]);
    const [detailReport, setDetailReport] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchReports();
    }, [filter.date, filter.user_id, filter.role]); // Chỉ thay đổi khi filter thay đổi

    const fetchReports = async () => {
        setLoading(true);
        setDetailReport(null);
        let query = supabase.from('checklist_logs').select('*, app_users(id, name, role)');

        // Lọc theo ngày
        if (filter.date) {
            query = query.eq('report_date', filter.date);
        }

        // Lọc theo người dùng
        if (filter.user_id) query = query.eq('user_id', filter.user_id);

        // Lọc theo khu vực
        if (filter.role) query = query.eq('role', filter.role);

        // Sắp xếp theo ngày mới nhất và thời gian tạo
        query = query.order('report_date', { ascending: false }).order('created_at', { ascending: false });

        const { data, error } = await query;
        if (error) setNotify("Lỗi tải báo cáo: " + error.message, "error");
        else setLogs(data || []);

        setLoading(false);
    };

    const handleDateChange = (e) => {
        setFilter(prev => ({ ...prev, date: e.target.value }));
    };

    const viewDetail = (log) => {
        // Ánh xạ dữ liệu báo cáo (log.data) với cấu hình công việc (allTasks)
        const roleTasks = allTasks.filter(t => t.role === log.role).sort((a, b) => {
            if (!a.time_label) return 1;
            if (!b.time_label) return -1;
            return a.time_label.localeCompare(b.time_label) || a.sort_order - b.sort_order;
        });

        const detailedItems = roleTasks.map(task => {
            const itemData = log.data[task.id];
            // Không tính trễ khi xem lịch sử, chỉ hiển thị trạng thái đã gửi
            return {
                ...task,
                ...itemData, // done, time, val, imageUrl, sent
                status: itemData?.sent ? 'sent' : 'pending',
            };
        });
        setDetailReport({ ...log, detailedItems });
    };

    // Chuẩn bị dữ liệu hiển thị trên bảng
    const roleMap = roles.reduce((acc, r) => ({ ...acc, [r.code]: r.name }), {});
    const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {});

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-800">Lịch Sử Báo Cáo Chi Tiết</h2>

            {/* Bộ Lọc */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-slate-600 block mb-1">Lọc theo Ngày</label>
                    <input type="date" className="w-full p-2 rounded border text-sm" value={filter.date} onChange={handleDateChange} max={getTodayISO()} />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-slate-600 block mb-1">Lọc theo Khu vực</label>
                    <select className="w-full p-2 rounded border text-sm bg-white" value={filter.role} onChange={e => setFilter({...filter, role: e.target.value, user_id: ''})}>
                        <option value="">-- Tất cả Khu vực --</option>
                        {roles.map(r => ( <option key={r.code} value={r.code}>{r.name}</option> ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label className="text-xs font-bold text-slate-600 block mb-1">Lọc theo Nhân viên</label>
                    <select className="w-full p-2 rounded border text-sm bg-white" value={filter.user_id} onChange={e => setFilter({...filter, user_id: e.target.value})}>
                        <option value="">-- Tất cả Nhân viên --</option>
                        {users.filter(u => !filter.role || u.role === filter.role).map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                </div>
                <button onClick={fetchReports} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
                    {loading ? <Loader2 className="animate-spin" size={16}/> : <RefreshCcw size={16}/>} Tải Dữ Liệu
                </button>
            </div>

            {/* Bảng Kết Quả */}
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs border-b">
                            <tr>
                                <th className="p-4">Ngày</th>
                                <th className="p-4">Khu Vực</th>
                                <th className="p-4">Nhân viên</th>
                                <th className="p-4">Tổng số việc</th>
                                <th className="p-4">Hoàn thành</th>
                                <th className="p-4">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading && <tr><td colSpan="6" className="p-6 text-center text-blue-500 font-medium"><Loader2 className="animate-spin inline mr-2"/>Đang tải...</td></tr>}
                            {!loading && logs.length === 0 && <tr><td colSpan="6" className="p-6 text-center text-slate-400">Không tìm thấy báo cáo nào với bộ lọc này</td></tr>}
                            {logs.map((log) => {
                                // Lấy số lượng task của role này để tính tổng
                                const roleTasksCount = allTasks.filter(t => t.role === log.role).length;
                                const sentCount = Object.values(log.data).filter(i => i.sent).length;
                                const percent = roleTasksCount > 0 ? Math.round((sentCount/roleTasksCount)*100) : 0;
                                return (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-mono text-slate-500">{log.report_date}</td>
                                        <td className="p-4 font-bold text-slate-700">{roleMap[log.role] || log.role}</td>
                                        <td className="p-4">{userMap[log.user_id] || log.app_users.name}</td>
                                        <td className="p-4">{roleTasksCount}</td>
                                        <td className="p-4"><span className={`font-bold ${percent === 100 ? 'text-emerald-600' : 'text-orange-500'}`}>{sentCount} ({percent}%)</span></td>
                                        <td className="p-4"><button onClick={() => viewDetail(log)} className="text-blue-600 hover:underline font-medium flex items-center gap-1"><ExternalLink size={16}/> Xem chi tiết</button></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Chi Tiết */}
            {detailReport && (
                <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white p-6 border-b flex justify-between items-center z-10">
                            <h3 className="font-bold text-xl text-slate-800">Chi Tiết Báo Cáo ({detailReport.report_date})</h3>
                            <button onClick={() => setDetailReport(null)} className="p-2 text-slate-500 hover:text-slate-800"><X size={24}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg text-sm">
                               <p><span className="font-bold block">Nhân viên:</span> {detailReport.app_users.name}</p>
                               <p><span className="font-bold block">Khu vực:</span> {roleMap[detailReport.role] || detailReport.role}</p>
                               <p><span className="font-bold block">Tổng việc:</span> {detailReport.detailedItems.length}</p>
                               <p><span className="font-bold block">Hoàn thành:</span> {detailReport.detailedItems.filter(i => i.sent).length}</p>
                           </div>
                           <h4 className="font-bold text-slate-700 mt-4">Danh Sách Công Việc</h4>
                           <div className="space-y-3">
                               {detailReport.detailedItems.map((item) => (
                                   <div key={item.id} className={`p-3 rounded-lg border flex items-center justify-between gap-3 text-sm ${item.status === 'sent' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                                       <div className="flex-1">
                                           <p className="font-medium text-slate-800">{item.title}</p>
                                           <p className="text-xs text-slate-500 flex items-center gap-2">
                                               <Clock size={12}/> {item.time_label}
                                               {item.time && <span>(Gửi lúc: {item.time})</span>}
                                           </p>
                                           {item.val && <p className="text-xs font-bold text-amber-700 mt-1">Ghi chú: {item.val}</p>}
                                       </div>
                                       <div className="flex gap-2 items-center">
                                           {item.imageUrl && (<a href={item.imageUrl} target="_blank" rel="noreferrer" className="text-indigo-600 text-xs flex items-center gap-1 hover:underline"><ImageIcon size={14}/> Xem Ảnh</a>)}
                                           <span className={`font-bold px-2 py-1 rounded-full text-xs ${item.status === 'sent' ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                               {item.status === 'sent' ? 'ĐÃ GỬI' : 'CHƯA GỬI'}
                                           </span>
                                       </div>
                                   </div>
                               ))}
                           </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ==========================================
// ADMIN DASHBOARD
// ==========================================
const AdminDashboard = ({ users, roles, allTasks, reports, timeLogs, onRefresh, onLogout, setNotify }) => {
    const [tab, setTab] = useState('timesheet'); // Giá trị mặc định
    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 sticky top-0 bg-white z-10 p-4 -mx-4 -mt-4 md:p-8 md:-mx-8">
                 <div className="flex items-center gap-3">
                    <ShieldCheck size={24} className="text-blue-600"/>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">Quản Lý Hệ Thống</h1>
                </div>
                <button onClick={onLogout} className="flex items-center gap-2 p-2 px-3 bg-red-100 text-red-600 rounded-full font-medium text-sm hover:bg-red-200 transition-colors"><LogOut size={16}/><span className="hidden sm:inline">Thoát</span></button>
            </div>

            <div className="flex gap-4 mb-6 border-b border-slate-200 pb-1 overflow-x-auto">
                {[
                    {id: 'timesheet', icon: CalendarClock, label: 'Chấm Công & Định Vị'},
                    {id: 'reports', icon: LayoutDashboard, label: 'Tiến Độ Hôm Nay'},
                    {id: 'history', icon: Clock, label: 'Lịch Sử Báo Cáo'}, // THÊM MỚI
                    {id: 'users', icon: Users, label: 'Nhân Sự'},
                    {id: 'tasks', icon: ListTodo, label: 'Cấu Hình Việc'},
                    {id: 'roles', icon: Briefcase, label: 'Khu Vực'}
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-3 font-bold text-sm whitespace-nowrap transition-all border-b-2 ${tab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        <t.icon size={18}/> {t.label}
                    </button>
                ))}
                <button onClick={onRefresh} className="ml-auto p-2 text-slate-400 hover:text-blue-600"><RefreshCcw size={18}/></button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow border border-slate-200">
                {tab === 'timesheet' && <AdminTimesheet timeLogs={timeLogs} users={users} />}
                {tab === 'reports' && <AdminReports reports={reports} allTasks={allTasks} roles={roles} />}
                {tab === 'history' && <AdminReportHistory allTasks={allTasks} roles={roles} users={users} setNotify={setNotify} />} {/* THÊM MỚI */}
                {tab === 'users' && <AdminUserManager users={users} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
                {tab === 'tasks' && <AdminTaskManager allTasks={allTasks} roles={roles} onRefresh={onRefresh} setNotify={setNotify} />}
                {tab === 'roles' && <AdminRoleManager roles={roles} allTasks={allTasks} onRefresh={onRefresh} setNotify={setNotify} />}
            </div>
        </div>
    );
};


// ==========================================
// APP CHÍNH
// ==========================================
const App = () => {
    const [user, setUser] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [rolesList, setRolesList] = useState([]);
    const [tasksConfig, setTasksConfig] = useState([]);
    const [reportsList, setReportsList] = useState([]);
    const [timeLogs, setTimeLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState({ msg: '', type: '' });

    const setNotify = (msg, type = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification({ msg: '', type: '' }), 5000);
    };

    const fetchAllDataAdmin = async () => {
        const today = getTodayISO();

        // Fetch users
        const { data: uData } = await supabase.from('app_users').select('*').order('created_at');
        setUsersList(uData || []);

        // Fetch roles
        const { data: rData } = await supabase.from('job_roles').select('*').order('created_at');
        setRolesList(rData || []);

        // Fetch tasks - Sắp xếp ưu tiên theo time_label (giờ), sau đó là sort_order
        const { data: tData } = await supabase.from('task_definitions')
          .select('*')
          .order('time_label', { ascending: true })
          .order('sort_order', { ascending: true });
        setTasksConfig(tData || []);

        // Fetch reports (logs) - Lấy tất cả báo cáo và user info (join)
        const { data: reportData } = await supabase.from('checklist_logs')
            .select('*, app_users(id, name, role)');
        setReportsList(reportData || []);

        // Fetch time logs
        const { data: logData } = await supabase.from('time_logs')
            .select('*')
            .order('created_at', { ascending: false });
        setTimeLogs(logData || []);
    };

    const fetchUserData = async () => {
        if (!user) return;

        // Fetch tasks
        const { data: tData } = await supabase.from('task_definitions')
          .select('*')
          .eq('role', user.role)
          .order('time_label', { ascending: true })
          .order('sort_order', { ascending: true });
        setTasksConfig(tData || []);

        // Fetch today's report
        const today = getTodayISO();
        const { data: reportData } = await supabase.from('checklist_logs')
            .select('*, app_users(id, name, role)')
            .eq('report_date', today)
            .eq('user_id', user.id);
        setReportsList(reportData || []);

        // Fetch all roles for display
        const { data: rData } = await supabase.from('job_roles').select('*');
        setRolesList(rData || []);
    };

    const handleRefresh = () => {
        setLoading(true);
        if (user && user.role === 'admin') {
            fetchAllDataAdmin().finally(() => setLoading(false));
        } else if (user) {
            fetchUserData().finally(() => setLoading(false));
        } else {
             setLoading(false);
        }
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    useEffect(() => {
        handleRefresh();
    }, [user]);

    const handleLogin = (userData) => {
        setUser(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('currentUser');
        setNotify("Đã đăng xuất.", "info");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100">
                <Loader2 className="animate-spin text-blue-600" size={48}/>
            </div>
        );
    }

    if (!user) {
        return <ModernLogin onLogin={handleLogin} setNotify={setNotify} />;
    }

    return (
        <>
            <CustomStyles />
            <Notification notification={notification} />
            {user.role === 'admin' ? (
                <AdminDashboard
                    users={usersList}
                    roles={rolesList}
                    allTasks={tasksConfig}
                    reports={reportsList}
                    timeLogs={timeLogs}
                    onRefresh={handleRefresh}
                    onLogout={handleLogout}
                    setNotify={setNotify}
                />
            ) : (
                <UserDashboard
                    user={user}
                    tasks={tasksConfig}
                    reports={reportsList}
                    roles={rolesList}
                    onLogout={handleLogout}
                    onRefresh={handleRefresh}
                    setNotify={setNotify}
                />
            )}
        </>
    );
};

export default App;