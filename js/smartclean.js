/**
 * NSG SMART CLEAN - HỆ THỐNG QUẢN LÝ VỆ SINH VÀ ĐÁNH GIÁ KPI NHÂN VIÊN
 * Trường Cao Đẳng Bách Khoa Nam Sài Gòn
 * 
 * Module tích hợp độc lập, bảo mật phân quyền nghiêm ngặt.
 */

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// State module NSG SMART CLEAN
export const SmartCleanState = {
    db: null,
    auth: null,
    currentUserData: null,
    activeSubTab: 'dashboard', // dashboard | staff | recurring | adhoc | inspect | kpi | reports
    staffList: [],
    recurringTasks: [],
    adhocTasks: [],
    inspections: [],
    kpiEvaluations: [],
    settings: {
        weights: { completion: 40, quality: 40, discipline: 10, safety: 10 }
    },
    // Filter states
    selectedStaffId: 'all',
    selectedArea: 'all',
    filterPeriod: 'month', // day | week | month | quarter
    filterDate: new Date().toISOString().split('T')[0],
    currentMonthYear: new Date().toISOString().slice(0, 7), // YYYY-MM
    // Live inspection draft
    inspectingStaffId: null,
    inspectionItems: [],
    unsubscribeFns: []
};

// ==========================================
// 1. DỮ LIỆU MẪU CÔ NGUYỄN THỊ CHUNG (MỤC 5)
// ==========================================
export const SAMPLE_STAFF_CHUNG = {
    fullName: "Nguyễn Thị Chung",
    staffCode: "NV-NTC-01",
    phone: "0908 123 456",
    assignedAreas: [
        "Khu B, từ Văn phòng Khoa CNTT-KTĐ đến A0.32",
        "Văn phòng Khoa CNTT-KTĐ và Văn phòng Khoa Y Dược",
        "Hành lang tầng trệt đến tầng 4 và 02 cầu thang",
        "Nhà vệ sinh nam/nữ tầng trệt đến tầng 3 và nhà vệ sinh Khu B",
        "Toàn bộ khu vực phụ trách về thu gom và xử lý rác",
        "Vệ sinh toàn trường ca tối thứ 3, 5, 7"
    ],
    note: "Nhân viên gương mẫu, phụ trách chính khối Khu B và ca tối 3-5-7. Chưa gán khu vực phòng học lý thuyết và hội trường theo quy định.",
    status: "active"
};

export const SAMPLE_RECURRING_TASKS_CHUNG = [
    {
        title: "Quét, lau vệ sinh sàn nhà, sân trường, lối đi và hành lang",
        area: "Khu B, sân trường và hành lang tầng trệt - tầng 4",
        frequency: "daily",
        shiftTime: "Ca sáng (06:00 - 08:30) & Chiều (13:00 - 14:30)",
        description: "Quét sạch rác, bụi mịn, lau bằng cây lau ướt và dung dịch tẩy rửa chuyên dụng, lau khô tránh trơn trượt.",
        criteria: "Sàn sạch bóng, không bụi cát, không vệt nước ố, không đọng rác ở góc tường",
        status: "active"
    },
    {
        title: "Vệ sinh bậc tam cấp, bậc cầu thang và lối dốc",
        area: "02 cầu thang Khu B và các lối dốc tam cấp",
        frequency: "daily",
        shiftTime: "Ca sáng (06:30 - 07:30) & Chiều (14:30 - 15:30)",
        description: "Quét sạch bụi bậc cầu thang, lau tay vịn cầu thang, lau sạch bậc dốc tam cấp.",
        criteria: "Bậc thang sạch không rác, tay vịn sạch bóng không bám bụi, gờ chống trượt không bám rêu",
        status: "active"
    },
    {
        title: "Vệ sinh bồn cây, thảm cỏ và khu vực ngoại cảnh",
        area: "Khu B và bồn cây ngoại cảnh quanh sảnh",
        frequency: "daily",
        shiftTime: "Ca sáng (06:00 - 07:00)",
        description: "Nhặt sạch rác trong bồn cây, thảm cỏ, quét lá rụng, tưới ẩm cây xanh nếu thời tiết nắng nóng.",
        criteria: "Bồn cây sạch cỏ rác, không có bao bì hộp xốp vứt bừa bãi, lối đi quanh thảm cỏ thông thoáng",
        status: "active"
    },
    {
        title: "Vệ sinh bàn ghế làm việc, bàn ghế học sinh, bàn ghế giáo viên",
        area: "Văn phòng Khoa CNTT-KTĐ và Khoa Y Dược",
        frequency: "daily",
        shiftTime: "Trước 07:00 sáng & sau 16:30 chiều",
        description: "Lau bụi mặt bàn, ghế làm việc của cán bộ giảng viên, sắp xếp bàn ghế ngay ngắn.",
        criteria: "Mặt bàn sạch bụi, không dính mực, không vết ố cà phê, ghế sắp xếp ngay ngắn thẳng hàng",
        status: "active"
    },
    {
        title: "Vệ sinh cửa kính, cửa chính và các vách ngăn",
        area: "Văn phòng Khoa, hành lang và cửa chính Khu B",
        frequency: "weekly",
        daysOfWeek: [5], // Thứ 6 hàng tuần
        shiftTime: "Chiều Thứ 6 (14:00 - 16:30)",
        description: "Lau sạch kính bằng nước rửa kính và gạt kính chuyên dụng, lau khung nhôm và vách ngăn.",
        criteria: "Kính trong suốt, không vệt ố loang, không bám dấu vân tay, khung cửa sạch bụi",
        status: "active"
    },
    {
        title: "Vệ sinh tủ hồ sơ, kệ tài liệu và các thiết bị văn phòng",
        area: "Văn phòng Khoa CNTT-KTĐ & Khoa Y Dược",
        frequency: "weekly",
        daysOfWeek: [6], // Thứ 7 hàng tuần
        shiftTime: "Sáng Thứ 7 (08:00 - 10:30)",
        description: "Lau nóc tủ, hông tủ, lau bụi bề mặt ngoài các thiết bị văn phòng (máy in, kệ khay tài liệu).",
        criteria: "Bề mặt tủ kệ sạch bụi, không làm xáo trộn tài liệu của văn phòng",
        status: "active"
    },
    {
        title: "Vệ sinh thiết bị điện, quạt, đèn và các thiết bị trong phòng",
        area: "Khu vực văn phòng và hành lang phụ trách",
        frequency: "monthly",
        shiftTime: "Thứ 7 tuần cuối tháng (07:30 - 11:00)",
        description: "Lau cánh quạt, lồng quạt, máng đèn chiếu sáng, công tắc điện (đảm bảo an toàn điện).",
        criteria: "Cánh quạt và lồng quạt sạch bụi bám, công tắc sạch sẽ, không dùng khăn ướt vào ổ điện",
        status: "active"
    },
    {
        title: "Vệ sinh bảng viết, bục phát biểu và khu vực hội trường",
        area: "Khu vực phát sinh theo điều phối",
        frequency: "on_demand",
        shiftTime: "Khi có sự kiện / Lịch thông báo",
        description: "Vệ sinh sạch bảng, lau bục phát biểu, chuẩn bị khăn trải và khu vực sân khấu khi có chỉ đạo.",
        criteria: "Bảng sạch không bụi phấn ứ đọng, bục phát biểu sạch bóng, khu vực chỉn chu",
        status: "active"
    },
    {
        title: "Vệ sinh tường, trần nhà và loại bỏ mạng nhện",
        area: "Hành lang Khu B tầng trệt đến tầng 4 & góc văn phòng",
        frequency: "weekly",
        daysOfWeek: [6], // Thứ 7
        shiftTime: "Sáng Thứ 7 (07:00 - 08:30)",
        description: "Dùng chổi quét trần quét sạch mạng nhện ở góc tường, trần nhà, hộp gen kỹ thuật.",
        criteria: "Trần nhà và góc tường sạch mạng nhện, không bụi bám mốc",
        status: "active"
    },
    {
        title: "Vệ sinh nhà vệ sinh: sàn, bồn cầu, bồn tiểu, lavabo, gương, vòi nước",
        area: "NVS nam/nữ tầng trệt đến tầng 3 và NVS Khu B",
        frequency: "daily",
        shiftTime: "3 lượt/ngày (07:00, 11:30, 16:30)",
        description: "Cọ rửa bồn cầu, bồn tiểu bằng hóa chất tẩy rửa diệt khuẩn, lau sạch lavabo, vòi xịt, gương soi, lau khô sàn.",
        criteria: "Sàn NVS khô ráo không trơn ướt, bồn cầu/tiểu trắng sạch không ố vàng, lavabo sạch bóng, gương sáng",
        status: "active"
    },
    {
        title: "Vệ sinh khay xà phòng, khu vực giấy vệ sinh, cửa và vách ngăn nhà vệ sinh",
        area: "Toàn bộ buồng NVS phụ trách",
        frequency: "daily",
        shiftTime: "Thường xuyên trong các ca trực NVS",
        description: "Châm thêm nước rửa tay, bổ sung giấy vệ sinh, lau sạch cánh cửa, tay nắm và vách ngăn buồng NVS.",
        criteria: "Khay luôn có xà phòng, giấy vệ sinh sẵn có, vách ngăn và cửa sạch không vết bẩn tay chân",
        status: "active"
    },
    {
        title: "Vệ sinh quạt thông gió và kiểm tra mùi nhà vệ sinh",
        area: "Các phòng NVS Khu B",
        frequency: "daily",
        shiftTime: "Đầu ca sáng & sau ca trưa",
        description: "Lau sạch bụi lưới quạt hút gió, xịt khử mùi, đặt sáp thơm, kiểm tra hệ thống thoát nước ngăn mùi hôi.",
        criteria: "Quạt thông gió hoạt động êm sạch bụi, không gian NVS thông thoáng, tuyệt đối không có mùi hôi nồng",
        status: "active"
    },
    {
        title: "Thu gom rác tại văn phòng, hành lang, nhà vệ sinh và các khu vực phụ trách",
        area: "Toàn bộ khu vực phụ trách",
        frequency: "daily",
        shiftTime: "2 lượt/ngày (11:00 & 16:30)",
        description: "Thu gom rác từ các sọt rác văn phòng, hành lang, NVS cho vào thùng gom rác lớn.",
        criteria: "Không để rác tràn sọt, gom rác đúng giờ quy định, không làm rơi vãi nước rác ra sàn",
        status: "active"
    },
    {
        title: "Thay túi rác, vệ sinh thùng rác và chuyển rác đến khu vực tập kết",
        area: "Khu vực tập kết rác toàn trường",
        frequency: "daily",
        shiftTime: "Cuối mỗi ca (11:30 & 17:00)",
        description: "Lót túi nilon mới cho các thùng rác, cọ rửa thùng rác sạch sẽ, đẩy xe rác ra bãi tập kết đúng quy định.",
        criteria: "Thùng rác có bao nilon sạch, bên ngoài thùng sạch sẽ, rác được đậy kín nắp tại nơi tập kết",
        status: "active"
    },
    {
        title: "Vệ sinh cống rãnh, kiểm tra khu vực thoát nước",
        area: "Hành lang thoát nước và rãnh quanh Khu B",
        frequency: "weekly",
        daysOfWeek: [5], // Thứ 6
        shiftTime: "Chiều Thứ 6 (15:00 - 16:30)",
        description: "Vớt rác lá cây đọng trên miệng hố ga, thông rãnh thoát nước, kiểm tra dòng chảy trước mùa mưa.",
        criteria: "Miệng cống sạch rác bẩn, không bị nghẹt úng nước khi có mưa, không bốc mùi hôi",
        status: "active"
    },
    {
        title: "Vệ sinh biển báo, bảng tin, ghế đá và bàn ghế ngoài trời",
        area: "Khuôn viên sảnh Khu B và lối đi",
        frequency: "daily",
        shiftTime: "Sáng sớm (06:30 - 07:15)",
        description: "Lau sạch bụi bảng tin, bảng chỉ dẫn, lau khô mặt ghế đá sân trường phục vụ sinh viên nghỉ chân.",
        criteria: "Ghế đá sạch sẽ khô ráo không đọng sương/bụi, bảng tin trong rõ không ố mờ",
        status: "active"
    },
    {
        title: "Vệ sinh, kiểm tra thiết bị phòng cháy chữa cháy",
        area: "Các bình PCCC và hộp cứu hỏa hành lang Khu B",
        frequency: "weekly",
        daysOfWeek: [1], // Thứ 2
        shiftTime: "Sáng Thứ 2 (07:00 - 07:45)",
        description: "Lau bụi vỏ bình PCCC, kiểm tra đồng hồ áp suất, lau kính hộp chữa cháy, đảm bảo không có vật cản lối vào bình.",
        criteria: "Bình chữa cháy sạch sẽ, kim áp suất chỉ vạch xanh, hộp PCCC không bị che khuất",
        status: "active"
    },
    {
        title: "Vệ sinh toàn trường ca tối thứ 3, 5, 7",
        area: "Toàn trường - ca tối",
        frequency: "days_of_week",
        daysOfWeek: [2, 4, 6], // Thứ 3, 5, 7
        shiftTime: "Ca tối (17:30 - 21:00)",
        description: "Quét dọn rác các khu vực hành lang, sân trường, kiểm tra các tầng sau giờ học ca tối, dọn rác phát sinh.",
        criteria: "Khuôn viên và hành lang sạch rác trước giờ đóng cửa trường, NVS được dọn dẹp sạch",
        status: "active"
    },
    {
        title: "Tắt đèn, thiết bị điện, khóa cửa và kiểm tra an toàn sau ca tối",
        area: "Các phòng học, văn phòng và cổng Khu B sau ca tối",
        frequency: "days_of_week",
        daysOfWeek: [2, 4, 6], // Thứ 3, 5, 7
        shiftTime: "Sau ca tối (20:45 - 21:00)",
        description: "Kiểm tra tắt toàn bộ đèn hành lang, quạt, máy lạnh còn sót, khóa cửa các phòng học và chốt khóa an toàn.",
        criteria: "100% thiết bị điện không dùng được tắt an toàn, cửa sổ và cửa ra vào được khóa chốt cẩn thận",
        status: "active"
    }
];

// ==========================================
// 2. KHỞI TẠO VÀ ĐỒNG BỘ DỮ LIỆU
// ==========================================
export async function initSmartCleanModule(currentUserData, db, auth, helpers = {}) {
    SmartCleanState.currentUserData = currentUserData;
    SmartCleanState.db = db;
    SmartCleanState.auth = auth;

    const role = currentUserData?.role || 'guest';
    const isManager = (role === 'admin' || role === 'truongphong' || role === 'phophong');

    // Chỉ Ban Quản Lý mới có quyền tải dữ liệu và khởi tạo
    if (!isManager) {
        console.log("NSG SMART CLEAN: Người dùng không có quyền truy cập module.");
        return false;
    }

    console.log(`NSG SMART CLEAN: Khởi tạo module thành công với quyền [${role}].`);

    // Hủy các listener cũ nếu có
    SmartCleanState.unsubscribeFns.forEach(unsub => unsub());
    SmartCleanState.unsubscribeFns = [];

    // 1. Lắng nghe hồ sơ nhân viên
    const qStaff = query(collection(db, 'clean_staff'));
    const unsubStaff = onSnapshot(qStaff, async (snapshot) => {
        SmartCleanState.staffList = [];
        snapshot.forEach(d => SmartCleanState.staffList.push({ id: d.id, ...d.data() }));

        // Kiểm tra và tự động khởi tạo dữ liệu mẫu cô Nguyễn Thị Chung nếu chưa có
        if (SmartCleanState.staffList.length === 0) {
            await seedSampleDataChung();
        } else {
            renderSmartCleanUI();
        }
    }, (err) => console.error("Lỗi Firestore clean_staff:", err));
    SmartCleanState.unsubscribeFns.push(unsubStaff);

    // 2. Lắng nghe công việc cố định
    const qRec = query(collection(db, 'clean_recurring_tasks'));
    const unsubRec = onSnapshot(qRec, (snapshot) => {
        SmartCleanState.recurringTasks = [];
        snapshot.forEach(d => SmartCleanState.recurringTasks.push({ id: d.id, ...d.data() }));
        renderSmartCleanUI();
    }, (err) => console.error("Lỗi Firestore clean_recurring_tasks:", err));
    SmartCleanState.unsubscribeFns.push(unsubRec);

    // 3. Lắng nghe công việc phát sinh
    const qAdhoc = query(collection(db, 'clean_adhoc_tasks'));
    const unsubAdhoc = onSnapshot(qAdhoc, (snapshot) => {
        SmartCleanState.adhocTasks = [];
        snapshot.forEach(d => SmartCleanState.adhocTasks.push({ id: d.id, ...d.data() }));
        renderSmartCleanUI();
    }, (err) => console.error("Lỗi Firestore clean_adhoc_tasks:", err));
    SmartCleanState.unsubscribeFns.push(unsubAdhoc);

    // 4. Lắng nghe lịch sử kiểm tra
    const qInsp = query(collection(db, 'clean_inspections'), orderBy('inspectionDate', 'desc'));
    const unsubInsp = onSnapshot(qInsp, (snapshot) => {
        SmartCleanState.inspections = [];
        snapshot.forEach(d => SmartCleanState.inspections.push({ id: d.id, ...d.data() }));
        renderSmartCleanUI();
    }, (err) => console.error("Lỗi Firestore clean_inspections:", err));
    SmartCleanState.unsubscribeFns.push(unsubInsp);

    // 5. Lắng nghe đánh giá KPI
    const qKpi = query(collection(db, 'clean_kpi_monthly'));
    const unsubKpi = onSnapshot(qKpi, (snapshot) => {
        SmartCleanState.kpiEvaluations = [];
        snapshot.forEach(d => SmartCleanState.kpiEvaluations.push({ id: d.id, ...d.data() }));
        renderSmartCleanUI();
    }, (err) => console.error("Lỗi Firestore clean_kpi_monthly:", err));
    SmartCleanState.unsubscribeFns.push(unsubKpi);

    // 6. Cấu hình trọng số
    try {
        const settingsDoc = await getDoc(doc(db, 'clean_settings', 'general'));
        if (settingsDoc.exists()) {
            SmartCleanState.settings = settingsDoc.data();
        } else if (role === 'admin') {
            await setDoc(doc(db, 'clean_settings', 'general'), SmartCleanState.settings);
        }
    } catch (e) {
        console.warn("Lấy settings clean_settings:", e.message);
    }

    return true;
}

// Khởi tạo hồ sơ mẫu cô Nguyễn Thị Chung vào Firestore
async function seedSampleDataChung() {
    try {
        console.log("NSG SMART CLEAN: Đang khởi tạo hồ sơ mẫu cô Nguyễn Thị Chung...");
        const staffRef = await addDoc(collection(SmartCleanState.db, 'clean_staff'), {
            ...SAMPLE_STAFF_CHUNG,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        const staffId = staffRef.id;

        // Thêm 19 công việc cố định gắn với cô Chung
        const batchPromises = SAMPLE_RECURRING_TASKS_CHUNG.map(task => {
            return addDoc(collection(SmartCleanState.db, 'clean_recurring_tasks'), {
                ...task,
                staffId: staffId,
                staffName: SAMPLE_STAFF_CHUNG.fullName,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });

        await Promise.all(batchPromises);
        console.log(`NSG SMART CLEAN: Đã khởi tạo hồ sơ cô Chung và ${SAMPLE_RECURRING_TASKS_CHUNG.length} đầu việc cố định.`);
    } catch (err) {
        console.error("Lỗi khởi tạo dữ liệu cô Chung:", err);
    }
}

// ==========================================
// 3. ĐIỀU HƯỚNG SUB-TAB TRONG MODULE
// ==========================================
export function switchSmartCleanSubTab(tabName) {
    SmartCleanState.activeSubTab = tabName;
    const tabs = ['dashboard', 'staff', 'recurring', 'adhoc', 'inspect', 'kpi', 'reports'];
    
    tabs.forEach(t => {
        const tabBtn = document.getElementById(`sc-tab-${t}`);
        const viewEl = document.getElementById(`sc-view-${t}`);
        if (tabBtn) {
            if (t === tabName) {
                tabBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-emerald-600 text-white shadow-sm flex items-center gap-1.5 transition-all";
            } else {
                tabBtn.className = "px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all flex items-center gap-1.5";
            }
        }
        if (viewEl) {
            if (t === tabName) viewEl.classList.remove('hidden');
            else viewEl.classList.add('hidden');
        }
    });

    renderSmartCleanUI();
}

// ==========================================
// 4. RENDERING TỪNG PHÂN HỆ
// ==========================================
export function renderSmartCleanUI() {
    const role = SmartCleanState.currentUserData?.role || 'guest';
    const isManager = (role === 'admin' || role === 'truongphong' || role === 'phophong');
    if (!isManager) return;

    switch (SmartCleanState.activeSubTab) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'staff':
            renderStaffList();
            break;
        case 'recurring':
            renderRecurringTasks();
            break;
        case 'adhoc':
            renderAdhocTasks();
            break;
        case 'inspect':
            renderInspectionView();
            break;
        case 'kpi':
            renderKpiView();
            break;
        case 'reports':
            renderReportsView();
            break;
    }
}

// --- 4.1. DASHBOARD TỔNG QUAN ---
function renderDashboard() {
    const staff = SmartCleanState.staffList;
    const recTasks = SmartCleanState.recurringTasks;
    const adhocTasks = SmartCleanState.adhocTasks;
    const inspections = SmartCleanState.inspections;

    // Tính toán số liệu hôm nay
    const todayStr = new Date().toISOString().split('T')[0];
    const todayInspections = inspections.filter(i => i.inspectionDate === todayStr);

    let todayPassed = 0;
    let todayFailed = 0;
    let todayNotDone = 0;

    todayInspections.forEach(i => {
        todayPassed += (i.passedItems || 0);
        todayFailed += (i.failedItems || 0);
        todayNotDone += (i.notDoneItems || 0);
    });

    // Đếm khu vực phụ trách độc lập
    const allAreas = new Set();
    staff.forEach(s => (s.assignedAreas || []).forEach(a => allAreas.add(a)));

    // Điểm KPI trung bình tháng hiện tại
    const currentMonth = SmartCleanState.currentMonthYear;
    const monthlyKpis = SmartCleanState.kpiEvaluations.filter(k => k.monthYear === currentMonth);
    const avgKpi = monthlyKpis.length > 0 
        ? Math.round(monthlyKpis.reduce((acc, k) => acc + (k.finalKpiScore || 0), 0) / monthlyKpis.length)
        : 100;

    // Render 10 Cards KPI
    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setTxt('sc-stat-total-staff', staff.length);
    setTxt('sc-stat-total-areas', allAreas.size);
    setTxt('sc-stat-recurring-tasks', recTasks.length);
    setTxt('sc-stat-today-inspections', todayInspections.length);
    setTxt('sc-stat-today-passed', todayPassed);
    setTxt('sc-stat-today-failed', todayFailed);
    setTxt('sc-stat-today-notdone', todayNotDone);
    setTxt('sc-stat-adhoc-tasks', adhocTasks.filter(t => t.status !== 'Đã hoàn thành').length);
    setTxt('sc-stat-avg-kpi', `${avgKpi}/100`);

    // Render danh sách kiểm tra gần đây trên Dashboard
    const recentListEl = document.getElementById('sc-recent-inspections');
    if (recentListEl) {
        if (inspections.length === 0) {
            recentListEl.innerHTML = `
                <div class="p-6 text-center text-slate-400 italic text-xs">
                    Chưa có đợt kiểm tra nào được ghi nhận. Bấm tab <strong>"📝 Kiểm Tra & Checklist"</strong> để thực hiện đánh giá.
                </div>
            `;
        } else {
            recentListEl.innerHTML = inspections.slice(0, 5).map(i => {
                const passPercent = i.passRate !== undefined ? Math.round(i.passRate) : 100;
                const badgeColor = passPercent >= 90 ? 'bg-emerald-100 text-emerald-800' : (passPercent >= 70 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800');
                return `
                    <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
                                🧹
                            </div>
                            <div>
                                <h4 class="text-xs sm:text-sm font-bold text-slate-800">${i.staffName}</h4>
                                <p class="text-[11px] text-slate-500">
                                    Ngày: <strong>${i.inspectionDate}</strong> (${i.inspectionTime || 'Trong ngày'}) &bull; Người kiểm tra: <strong>${i.inspectorName || 'Giám sát'}</strong>
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3 self-end sm:self-center">
                            <div class="text-right">
                                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}">
                                    ${passPercent}% Đạt (${i.passedItems || 0}/${(i.totalItems || 0) - (i.notApplicableItems || 0)})
                                </span>
                                <div class="text-[10px] text-slate-400 mt-0.5">${i.failedItems || 0} lỗi cần khắc phục</div>
                            </div>
                            <button onclick="window.viewInspectionDetail('${i.id}')" class="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors">
                                Chi tiết
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

// --- 4.2. QUẢN LÝ NHÂN VIÊN VỆ SINH ---
function renderStaffList() {
    const listEl = document.getElementById('sc-staff-cards');
    if (!listEl) return;

    const staff = SmartCleanState.staffList;
    const role = SmartCleanState.currentUserData?.role;
    const canEdit = (role === 'admin' || role === 'phophong');

    if (staff.length === 0) {
        listEl.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs italic">
                Chưa có hồ sơ nhân viên vệ sinh nào. Bấm "+ Thêm Nhân Viên" để khởi tạo.
            </div>
        `;
        return;
    }

    listEl.innerHTML = staff.map(s => {
        const staffRecTasks = SmartCleanState.recurringTasks.filter(t => t.staffId === s.id);
        const staffInspections = SmartCleanState.inspections.filter(i => i.staffId === s.id);
        const isActive = (s.status === 'active');

        return `
            <div class="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    <!-- Header -->
                    <div class="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                        <div class="flex items-center gap-3">
                            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0">
                                ${s.fullName.split(' ').slice(-1)[0].charAt(0)}
                            </div>
                            <div>
                                <h4 class="font-extrabold text-sm sm:text-base text-slate-900">${s.fullName}</h4>
                                <div class="flex items-center gap-2 mt-0.5">
                                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                        ${s.staffCode || 'NV-VS'}
                                    </span>
                                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
                                        ${isActive ? 'Đang làm việc' : 'Ngừng phân công'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        ${canEdit ? `
                        <div class="flex items-center gap-1">
                            <button onclick="window.openEditStaffModal('${s.id}')" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors" title="Sửa thông tin">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                        </div>` : ''}
                    </div>

                    <!-- Khu vực phụ trách -->
                    <div class="mt-3">
                        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                            📍 Khu vực phụ trách (${(s.assignedAreas || []).length}):
                        </span>
                        <div class="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                            ${(s.assignedAreas || []).map(a => `
                                <div class="text-xs text-slate-700 bg-slate-50 p-1.5 rounded-lg border border-slate-100 flex items-start gap-1.5">
                                    <span class="text-emerald-500 shrink-0 mt-0.5">&bull;</span>
                                    <span class="line-clamp-2">${a}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Ghi chú nếu có -->
                    ${s.note ? `
                    <p class="text-[11px] text-slate-500 italic mt-2.5 bg-amber-50/60 p-2 rounded-xl border border-amber-100">
                        <strong>Lưu ý:</strong> ${s.note}
                    </p>` : ''}
                </div>

                <!-- Footer Stats & Actions -->
                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                        <span class="font-extrabold text-slate-800">${staffRecTasks.length}</span> <span class="text-slate-500">việc cố định</span> &bull;
                        <span class="font-extrabold text-emerald-700">${staffInspections.length}</span> <span class="text-slate-500">lần kiểm tra</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        <button onclick="window.startInspectStaff('${s.id}')" class="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all flex items-center gap-1">
                            <span>Kiểm tra</span> &rarr;
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// --- 4.3. QUẢN LÝ CÔNG VIỆC CỐ ĐỊNH ---
function renderRecurringTasks() {
    const tbody = document.getElementById('sc-recurring-table-body');
    if (!tbody) return;

    const filterStaff = document.getElementById('sc-filter-rec-staff')?.value || 'all';
    const filterFreq = document.getElementById('sc-filter-rec-freq')?.value || 'all';
    const searchVal = document.getElementById('sc-search-rec')?.value.toLowerCase().trim() || '';

    let tasks = SmartCleanState.recurringTasks;

    if (filterStaff !== 'all') tasks = tasks.filter(t => t.staffId === filterStaff);
    if (filterFreq !== 'all') tasks = tasks.filter(t => t.frequency === filterFreq);
    if (searchVal) {
        tasks = tasks.filter(t => 
            (t.title || '').toLowerCase().includes(searchVal) || 
            (t.area || '').toLowerCase().includes(searchVal) ||
            (t.criteria || '').toLowerCase().includes(searchVal)
        );
    }

    const freqMap = {
        'daily': { label: 'Hằng ngày', color: 'bg-blue-100 text-blue-800' },
        'shift': { label: 'Theo ca', color: 'bg-indigo-100 text-indigo-800' },
        'days_of_week': { label: 'Thứ 3-5-7', color: 'bg-purple-100 text-purple-800' },
        'weekly': { label: 'Hằng tuần', color: 'bg-amber-100 text-amber-800' },
        'monthly': { label: 'Hằng tháng', color: 'bg-rose-100 text-rose-800' },
        'on_demand': { label: 'Theo yêu cầu', color: 'bg-slate-100 text-slate-800' }
    };

    const role = SmartCleanState.currentUserData?.role;
    const canEdit = (role === 'admin' || role === 'phophong');

    if (tasks.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-400 italic text-xs">
                    Không tìm thấy công việc cố định nào phù hợp bộ lọc.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = tasks.map((t, idx) => {
        const fBadge = freqMap[t.frequency] || { label: t.frequency, color: 'bg-slate-100 text-slate-700' };
        return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs">
                <td class="p-3 text-center text-slate-400 font-bold">${idx + 1}</td>
                <td class="p-3">
                    <span class="font-extrabold text-slate-800 block">${t.title}</span>
                    <span class="text-[11px] text-slate-500 line-clamp-1 mt-0.5">${t.description || ''}</span>
                </td>
                <td class="p-3 font-semibold text-slate-700">${t.staffName || 'Chưa gán'}</td>
                <td class="p-3 text-slate-600">${t.area || '-'}</td>
                <td class="p-3">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${fBadge.color} whitespace-nowrap">
                        ${fBadge.label}
                    </span>
                    <span class="block text-[10px] text-slate-400 mt-0.5">${t.shiftTime || ''}</span>
                </td>
                <td class="p-3 text-slate-600 text-[11px] italic max-w-xs">${t.criteria || '-'}</td>
                <td class="p-3 text-center">
                    ${canEdit ? `
                    <div class="flex items-center justify-center gap-1">
                        <button onclick="window.openEditRecurringTaskModal('${t.id}')" class="p-1 text-slate-400 hover:text-blue-600 rounded-lg" title="Sửa">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button onclick="window.deleteRecurringTask('${t.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded-lg" title="Xóa">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>` : '<span class="text-slate-400">-</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// --- 4.4. QUẢN LÝ CÔNG VIỆC PHÁT SINH ---
function renderAdhocTasks() {
    const container = document.getElementById('sc-adhoc-cards');
    if (!container) return;

    const tasks = SmartCleanState.adhocTasks;
    const role = SmartCleanState.currentUserData?.role;
    const canEdit = (role === 'admin' || role === 'phophong');

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs italic">
                Chưa có công việc phát sinh nào. Bấm "+ Giao Việc Phát Sinh" khi có yêu cầu đột xuất.
            </div>
        `;
        return;
    }

    const priorityBadge = {
        'Khẩn cấp': 'bg-rose-100 text-rose-800 border-rose-200',
        'Cao': 'bg-amber-100 text-amber-800 border-amber-200',
        'Bình thường': 'bg-slate-100 text-slate-700 border-slate-200'
    };

    container.innerHTML = tasks.map(t => {
        const pClass = priorityBadge[t.priority] || priorityBadge['Bình thường'];
        const isDone = (t.status === 'Đã hoàn thành');
        return `
            <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                    <div class="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                        <div>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${pClass}">
                                ${t.priority || 'Bình thường'}
                            </span>
                            <h4 class="font-extrabold text-sm sm:text-base text-slate-800 mt-1">${t.title}</h4>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                            ${t.status || 'Chưa thực hiện'}
                        </span>
                    </div>

                    <div class="mt-3 space-y-1.5 text-xs text-slate-600">
                        <p>📍 <strong>Khu vực:</strong> ${t.area || '-'}</p>
                        <p>👤 <strong>Người làm:</strong> ${(t.staffNames || []).join(', ') || '-'}</p>
                        <p>📅 <strong>Hạn hoàn thành:</strong> ${t.dueDate || '-'} (${t.dueTime || 'Trong ca'})</p>
                        ${t.content ? `<p class="text-slate-500 italic bg-slate-50 p-2 rounded-xl mt-1 border border-slate-100">${t.content}</p>` : ''}
                    </div>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span class="text-[11px] text-slate-400">Giao bởi: ${t.assignedBy || 'BQL'}</span>
                    ${canEdit ? `
                    <div class="flex items-center gap-1.5">
                        ${!isDone ? `
                        <button onclick="window.markAdhocTaskDone('${t.id}')" class="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors">
                            Nghiệm thu ✓
                        </button>` : ''}
                        <button onclick="window.deleteAdhocTask('${t.id}')" class="p-1 text-slate-400 hover:text-rose-600 rounded-lg" title="Xóa">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// --- 4.5. KIỂM TRA & CHECKLIST THỰC TẾ ---
function renderInspectionView() {
    const staffSelect = document.getElementById('sc-inspect-staff-select');
    if (staffSelect) {
        const curVal = staffSelect.value;
        staffSelect.innerHTML = '<option value="">-- Chọn nhân viên để kiểm tra --</option>' + 
            SmartCleanState.staffList.filter(s => s.status === 'active').map(s => `
                <option value="${s.id}" ${s.id === curVal ? 'selected' : ''}>👤 ${s.fullName} (${s.staffCode})</option>
            `).join('');
    }

    // Nếu đã chọn nhân viên, render checklist các công việc đến hạn
    renderActiveInspectionChecklist();
}

export function renderActiveInspectionChecklist() {
    const staffId = document.getElementById('sc-inspect-staff-select')?.value;
    const dateInput = document.getElementById('sc-inspect-date')?.value || new Date().toISOString().split('T')[0];
    const container = document.getElementById('sc-inspect-checklist-container');
    if (!container) return;

    if (!staffId) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-400 italic text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Vui lòng chọn nhân viên vệ sinh ở trên để hệ thống tự động tải checklist công việc đến hạn.
            </div>
        `;
        return;
    }

    const staffObj = SmartCleanState.staffList.find(s => s.id === staffId);
    if (!staffObj) return;

    // Lọc công việc cố định của nhân viên đến hạn vào ngày đã chọn
    const inspectDate = new Date(dateInput);
    const dayOfWeek = inspectDate.getDay(); // 0: CN, 1: T2, 2: T3, 3: T4, 4: T5, 5: T6, 6: T7

    const dueRecurring = SmartCleanState.recurringTasks.filter(t => {
        if (t.staffId !== staffId || t.status !== 'active') return false;
        if (t.frequency === 'daily' || t.frequency === 'shift') return true;
        if (t.frequency === 'days_of_week') {
            return (t.daysOfWeek || []).includes(dayOfWeek);
        }
        if (t.frequency === 'weekly') {
            return (t.daysOfWeek || [5]).includes(dayOfWeek);
        }
        if (t.frequency === 'on_demand') return true; // Cho phép kiểm tra nếu có phát sinh
        return true;
    });

    // Lọc việc phát sinh của nhân viên đó trong ngày
    const dueAdhoc = SmartCleanState.adhocTasks.filter(t => {
        return (t.staffIds || []).includes(staffId) && (t.dueDate === dateInput || t.assignedDate === dateInput);
    });

    const allItems = [
        ...dueRecurring.map(t => ({ taskId: t.id, taskType: 'recurring', title: t.title, area: t.area, criteria: t.criteria })),
        ...dueAdhoc.map(t => ({ taskId: t.id, taskType: 'adhoc', title: `[Phát sinh] ${t.title}`, area: t.area, criteria: t.content }))
    ];

    if (allItems.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-slate-500 text-xs bg-white rounded-2xl border border-slate-200">
                Không có công việc nào theo lịch cần kiểm tra cho <strong>${staffObj.fullName}</strong> vào ngày ${dateInput}.
            </div>
        `;
        return;
    }

    // Khởi tạo checklist draft nếu chưa có
    SmartCleanState.inspectingStaffId = staffId;
    SmartCleanState.inspectionItems = allItems.map(item => ({
        ...item,
        status: 'passed', // Mặc định Đạt để thao tác nhanh
        note: '',
        correctionRequired: false
    }));

    renderChecklistRows();
}

function renderChecklistRows() {
    const container = document.getElementById('sc-inspect-checklist-container');
    if (!container) return;

    container.innerHTML = `
        <div class="space-y-3">
            ${SmartCleanState.inspectionItems.map((item, idx) => {
                const s = item.status;
                return `
                    <div class="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col gap-2.5">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <span class="text-xs font-bold text-slate-800">${idx + 1}. ${item.title}</span>
                                <p class="text-[11px] text-slate-500">📍 Khu vực: <strong>${item.area || '-'}</strong> &bull; Tiêu chí: <span class="italic text-slate-600">${item.criteria || '-'}</span></p>
                            </div>
                            
                            <!-- 4 Nút Trạng Thái: Đạt, Không đạt, Chưa thực hiện, Không áp dụng -->
                            <div class="flex items-center gap-1 self-start sm:self-center shrink-0">
                                <button type="button" onclick="window.setInspectionItemStatus(${idx}, 'passed')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${s === 'passed' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}">
                                    ✓ Đạt
                                </button>
                                <button type="button" onclick="window.setInspectionItemStatus(${idx}, 'failed')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${s === 'failed' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}">
                                    ✗ Không đạt
                                </button>
                                <button type="button" onclick="window.setInspectionItemStatus(${idx}, 'not_done')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${s === 'not_done' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}">
                                    ⏳ Chưa làm
                                </button>
                                <button type="button" onclick="window.setInspectionItemStatus(${idx}, 'not_applicable')" class="px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${s === 'not_applicable' ? 'bg-slate-700 text-white border-slate-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}">
                                    \\ Miễn/K.Áp dụng
                                </button>
                            </div>
                        </div>

                        <!-- Ghi chú & Yêu cầu khắc phục khi không đạt hoặc có lưu ý -->
                        <div class="flex items-center gap-2 pt-1">
                            <input type="text" placeholder="Nhập ghi chú lỗi hoặc nhắc nhở..." value="${item.note || ''}" onchange="window.setInspectionItemNote(${idx}, this.value)" class="flex-1 text-xs px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                            <label class="flex items-center gap-1.5 text-xs text-rose-600 font-semibold cursor-pointer shrink-0">
                                <input type="checkbox" ${item.correctionRequired ? 'checked' : ''} onchange="window.setInspectionCorrectionRequired(${idx}, this.checked)" class="rounded text-rose-600 focus:ring-rose-500">
                                Yêu cầu khắc phục
                            </label>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Lưu bản ghi kiểm tra mới vào Firestore
export async function saveCurrentInspection() {
    const staffId = document.getElementById('sc-inspect-staff-select')?.value;
    const date = document.getElementById('sc-inspect-date')?.value || new Date().toISOString().split('T')[0];
    const time = document.getElementById('sc-inspect-time')?.value || new Date().toTimeString().slice(0, 5);
    const comment = document.getElementById('sc-inspect-comment')?.value.trim();
    const imageUrl = document.getElementById('sc-inspect-image')?.value.trim();

    if (!staffId) {
        window.showToast("Vui lòng chọn nhân viên được kiểm tra!", "warning");
        return;
    }

    const staffObj = SmartCleanState.staffList.find(s => s.id === staffId);
    const items = SmartCleanState.inspectionItems;

    if (!items || items.length === 0) {
        window.showToast("Không có đầu việc nào để lưu!", "warning");
        return;
    }

    const totalItems = items.length;
    const passedItems = items.filter(i => i.status === 'passed').length;
    const failedItems = items.filter(i => i.status === 'failed').length;
    const notDoneItems = items.filter(i => i.status === 'not_done').length;
    const notApplicableItems = items.filter(i => i.status === 'not_applicable').length;

    const evaluableItems = totalItems - notApplicableItems;
    const passRate = evaluableItems > 0 ? (passedItems / evaluableItems) * 100 : 100;

    const btn = document.getElementById('sc-btn-save-inspect');
    if (btn) {
        btn.innerText = "Đang lưu...";
        btn.disabled = true;
    }

    try {
        const record = {
            staffId: staffId,
            staffName: staffObj.fullName,
            inspectorUid: SmartCleanState.auth.currentUser?.uid || '',
            inspectorName: SmartCleanState.currentUserData?.displayName || 'Phó Trưởng Phòng',
            inspectorRole: SmartCleanState.currentUserData?.role || 'phophong',
            inspectionDate: date,
            inspectionTime: time,
            items: items,
            generalComment: comment || '',
            evidenceImages: imageUrl ? [imageUrl] : [],
            totalItems: totalItems,
            passedItems: passedItems,
            failedItems: failedItems,
            notDoneItems: notDoneItems,
            notApplicableItems: notApplicableItems,
            passRate: passRate,
            status: failedItems > 0 ? 'needs_correction' : 'completed',
            createdAt: serverTimestamp()
        };

        await addDoc(collection(SmartCleanState.db, 'clean_inspections'), record);

        // Tự động tính toán & cập nhật lại KPI tháng tương ứng
        await calculateMonthlyKpiForStaff(staffId, date.slice(0, 7));

        window.showToast("Đã lưu kết quả kiểm tra thành công!", "success");
        // Reset form
        if (document.getElementById('sc-inspect-comment')) document.getElementById('sc-inspect-comment').value = '';
        if (document.getElementById('sc-inspect-image')) document.getElementById('sc-inspect-image').value = '';
        renderActiveInspectionChecklist();
    } catch (e) {
        console.error("Lỗi lưu phiếu kiểm tra:", e);
        window.showToast("Lỗi lưu phiếu kiểm tra: " + e.message, "error");
    } finally {
        if (btn) {
            btn.innerText = "Lưu Kết Quả Kiểm Tra";
            btn.disabled = false;
        }
    }
}

// --- 4.6. ĐÁNH GIÁ KPI NHÂN VIÊN ---
export async function calculateMonthlyKpiForStaff(staffId, monthYear) {
    const staffObj = SmartCleanState.staffList.find(s => s.id === staffId);
    if (!staffObj) return;

    // Lọc tất cả các đợt kiểm tra trong tháng của nhân viên này
    const monthInspections = SmartCleanState.inspections.filter(i => 
        i.staffId === staffId && i.inspectionDate.startsWith(monthYear)
    );

    let totalEvaluable = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalCorrection = 0;

    monthInspections.forEach(i => {
        totalPassed += (i.passedItems || 0);
        totalFailed += (i.failedItems || 0);
        totalEvaluable += ((i.totalItems || 0) - (i.notApplicableItems || 0));
        (i.items || []).forEach(it => {
            if (it.correctionRequired) totalCorrection++;
        });
    });

    // 1. Tỷ lệ hoàn thành công việc (Completion Rate): 40%
    const completionRate = totalEvaluable > 0 ? Math.round((totalPassed / totalEvaluable) * 100) : 100;

    // 2. Chất lượng vệ sinh (Quality Score): 40% (Trừ điểm theo số lỗi không đạt)
    const qualityScore = Math.max(0, 100 - (totalFailed * 5));

    // 3. Thời gian và kỷ luật (Discipline Score): 10%
    const disciplineScore = 100;

    // 4. Chấp hành quy trình và an toàn (Safety Score): 10%
    const safetyComplianceScore = 100;

    const weights = SmartCleanState.settings.weights || { completion: 40, quality: 40, discipline: 10, safety: 10 };
    const finalScore = Math.round(
        (completionRate * (weights.completion / 100)) +
        (qualityScore * (weights.quality / 100)) +
        (disciplineScore * (weights.discipline / 100)) +
        (safetyComplianceScore * (weights.safety / 100))
    );

    let ranking = "Xuất sắc";
    if (finalScore < 50) ranking = "Yếu / Cần nhắc nhở";
    else if (finalScore < 65) ranking = "Trung bình";
    else if (finalScore < 80) ranking = "Khá";
    else if (finalScore < 90) ranking = "Tốt";

    const kpiDocId = `kpi_${staffId}_${monthYear}`;
    const kpiData = {
        staffId: staffId,
        staffName: staffObj.fullName,
        monthYear: monthYear,
        completionRate: completionRate,
        qualityScore: qualityScore,
        disciplineScore: disciplineScore,
        safetyComplianceScore: safetyComplianceScore,
        weights: weights,
        finalKpiScore: finalScore,
        ranking: ranking,
        totalInspections: monthInspections.length,
        totalPassed: totalPassed,
        totalFailed: totalFailed,
        totalCorrectionRequests: totalCorrection,
        updatedAt: serverTimestamp()
    };

    await setDoc(doc(SmartCleanState.db, 'clean_kpi_monthly', kpiDocId), kpiData, { merge: true });
}

function renderKpiView() {
    const container = document.getElementById('sc-kpi-table-body');
    if (!container) return;

    const monthYear = document.getElementById('sc-kpi-month')?.value || SmartCleanState.currentMonthYear;
    const staff = SmartCleanState.staffList;

    if (staff.length === 0) {
        container.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400 italic text-xs">Chưa có dữ liệu nhân viên.</td></tr>`;
        return;
    }

    const rankBadge = {
        'Xuất sắc': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'Tốt': 'bg-teal-100 text-teal-800 border-teal-200',
        'Khá': 'bg-blue-100 text-blue-800 border-blue-200',
        'Trung bình': 'bg-amber-100 text-amber-800 border-amber-200',
        'Yếu / Cần nhắc nhở': 'bg-rose-100 text-rose-800 border-rose-200'
    };

    const role = SmartCleanState.currentUserData?.role;
    const canAdjust = (role === 'admin' || role === 'phophong');
    const canApprove = (role === 'admin' || role === 'truongphong');

    container.innerHTML = staff.map((s, idx) => {
        const kpi = SmartCleanState.kpiEvaluations.find(k => k.staffId === s.id && k.monthYear === monthYear);
        const score = kpi ? kpi.finalKpiScore : 100;
        const rank = kpi ? kpi.ranking : 'Xuất sắc';
        const rClass = rankBadge[rank] || rankBadge['Xuất sắc'];
        const isApproved = kpi?.managerApproval?.approved;

        return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs">
                <td class="p-3 text-center text-slate-400 font-bold">${idx + 1}</td>
                <td class="p-3">
                    <span class="font-extrabold text-slate-800 block">${s.fullName}</span>
                    <span class="text-[11px] text-slate-400 font-medium">${s.staffCode}</span>
                </td>
                <td class="p-3 text-center font-bold text-slate-700">${kpi ? kpi.totalInspections : 0} lượt</td>
                <td class="p-3 text-center text-emerald-600 font-semibold">${kpi ? kpi.completionRate : 100}%</td>
                <td class="p-3 text-center text-blue-600 font-semibold">${kpi ? kpi.qualityScore : 100}%</td>
                <td class="p-3 text-center">
                    <span class="text-base font-extrabold text-slate-800">${score}</span>
                    <span class="text-[10px] text-slate-400">/100</span>
                </td>
                <td class="p-3 text-center">
                    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full border ${rClass}">
                        ${rank}
                    </span>
                    ${isApproved ? '<span class="block text-[9px] text-emerald-600 font-bold mt-0.5">✓ Đã duyệt</span>' : ''}
                </td>
                <td class="p-3 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        ${canAdjust ? `
                        <button onclick="window.openAdjustKpiModal('${s.id}', '${monthYear}')" class="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
                            Điều chỉnh
                        </button>` : ''}
                        ${(canApprove && !isApproved && kpi) ? `
                        <button onclick="window.approveKpiResult('${kpi.id}')" class="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors" title="Trưởng phòng xác nhận">
                            Duyệt
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// --- 4.7. BÁO CÁO & THỐNG KÊ ---
function renderReportsView() {
    // Có thể lọc và xuất Excel theo từng phân hệ
}

// Xuất file Excel báo cáo kiểm tra vệ sinh
export async function exportSmartCleanExcel(reportType = 'monthly') {
    if (typeof XLSX === 'undefined') {
        window.showToast("Đang tải thư viện Excel...", "info");
        try {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        } catch (e) {
            window.showToast("Không thể tải module Excel: " + e.message, "error");
            return;
        }
    }

    const monthYear = SmartCleanState.currentMonthYear;
    const inspections = SmartCleanState.inspections.filter(i => i.inspectionDate.startsWith(monthYear));

    if (inspections.length === 0) {
        window.showToast("Không có dữ liệu kiểm tra nào trong tháng để xuất!", "warning");
        return;
    }

    const data = inspections.map((i, idx) => ({
        "STT": idx + 1,
        "Ngày Kiểm Tra": i.inspectionDate,
        "Giờ": i.inspectionTime || '',
        "Nhân Viên Vệ Sinh": i.staffName,
        "Người Giám Sát": i.inspectorName,
        "Tổng Đầu Việc": i.totalItems || 0,
        "Số Việc Đạt (✓)": i.passedItems || 0,
        "Số Việc Không Đạt (✗)": i.failedItems || 0,
        "Chưa Làm (⏳)": i.notDoneItems || 0,
        "Không Áp Dụng (\\)": i.notApplicableItems || 0,
        "Tỷ Lệ Đạt (%)": `${Math.round(i.passRate || 100)}%`,
        "Kết Luận": (i.failedItems || 0) === 0 ? "ĐẠT CHUẨN" : "CÓ LỖI CHƯA ĐẠT",
        "Ý Kiến Giám Sát": i.generalComment || '',
        "Chi Tiết Lỗi / Khắc Phục": (i.items || [])
            .filter(it => it.status === 'failed' || it.correctionRequired)
            .map(it => `${it.title}: ${it.note || 'Lỗi chất lượng'} (Khắc phục: ${it.correctionRequired ? 'Có' : 'Không'})`)
            .join('; ')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [
        { wch: 6 },  // STT
        { wch: 14 }, // Ngay
        { wch: 10 }, // Gio
        { wch: 22 }, // Nhan vien
        { wch: 22 }, // Giam sat
        { wch: 14 }, // Tong
        { wch: 15 }, // Dat
        { wch: 18 }, // Khong dat
        { wch: 14 }, // Chua lam
        { wch: 16 }, // K.Ap dung
        { wch: 14 }, // % Dat
        { wch: 18 }, // Ket luan
        { wch: 30 }, // Nhan xet
        { wch: 45 }  // Chi tiet loi
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BaoCao_KiemTra_SmartClean");
    XLSX.writeFile(wb, `NSG_SmartClean_BaoCao_${monthYear}.xlsx`);
    window.showToast("Đã xuất báo cáo Excel Smart Clean thành công!", "success");
}

// In báo cáo chuẩn
export function printSmartCleanReport() {
    window.print();
}

// ==========================================
// 5. GẮN CÁC HÀM TIỆN ÍCH LÊN WINDOW ĐỂ UI GỌI
// ==========================================
window.switchSmartCleanSubTab = switchSmartCleanSubTab;
window.exportSmartCleanExcel = exportSmartCleanExcel;
window.printSmartCleanReport = printSmartCleanReport;

window.setInspectionItemStatus = (idx, status) => {
    if (SmartCleanState.inspectionItems[idx]) {
        SmartCleanState.inspectionItems[idx].status = status;
        renderChecklistRows();
    }
};

window.setInspectionItemNote = (idx, note) => {
    if (SmartCleanState.inspectionItems[idx]) {
        SmartCleanState.inspectionItems[idx].note = note;
    }
};

window.setInspectionCorrectionRequired = (idx, checked) => {
    if (SmartCleanState.inspectionItems[idx]) {
        SmartCleanState.inspectionItems[idx].correctionRequired = checked;
    }
};

window.startInspectStaff = (staffId) => {
    switchSmartCleanSubTab('inspect');
    const selectEl = document.getElementById('sc-inspect-staff-select');
    if (selectEl) {
        selectEl.value = staffId;
        renderActiveInspectionChecklist();
    }
};

window.saveCurrentInspection = saveCurrentInspection;

// ==========================================
// 6. MODALS & CRUD OPERATIONS
// ==========================================

// --- STAFF CRUD ---
window.openAddStaffModal = () => {
    document.getElementById('scStaffModalTitle').innerText = "Thêm Hồ Sơ Nhân Viên Vệ Sinh";
    document.getElementById('scStaffId').value = "";
    document.getElementById('scStaffFullName').value = "";
    document.getElementById('scStaffCode').value = `NV-VS-${String(SmartCleanState.staffList.length + 1).padStart(2, '0')}`;
    document.getElementById('scStaffPhone').value = "";
    document.getElementById('scStaffAreas').value = "";
    document.getElementById('scStaffNote').value = "";
    document.getElementById('scStaffStatus').value = "active";
    document.getElementById('scStaffModal').classList.remove('hidden');
};

window.openEditStaffModal = (staffId) => {
    const s = SmartCleanState.staffList.find(x => x.id === staffId);
    if (!s) return;
    document.getElementById('scStaffModalTitle').innerText = "Chỉnh Sửa Hồ Sơ Nhân Viên Vệ Sinh";
    document.getElementById('scStaffId').value = s.id;
    document.getElementById('scStaffFullName').value = s.fullName || '';
    document.getElementById('scStaffCode').value = s.staffCode || '';
    document.getElementById('scStaffPhone').value = s.phone || '';
    document.getElementById('scStaffAreas').value = (s.assignedAreas || []).join('\n');
    document.getElementById('scStaffNote').value = s.note || '';
    document.getElementById('scStaffStatus').value = s.status || 'active';
    document.getElementById('scStaffModal').classList.remove('hidden');
};

window.closeStaffModal = () => {
    document.getElementById('scStaffModal').classList.add('hidden');
};

window.saveStaffFromModal = async () => {
    const id = document.getElementById('scStaffId').value;
    const fullName = document.getElementById('scStaffFullName').value.trim();
    const staffCode = document.getElementById('scStaffCode').value.trim();
    const phone = document.getElementById('scStaffPhone').value.trim();
    const areasRaw = document.getElementById('scStaffAreas').value.trim();
    const note = document.getElementById('scStaffNote').value.trim();
    const status = document.getElementById('scStaffStatus').value;

    if (!fullName || !staffCode) {
        window.showToast("Vui lòng nhập họ tên và mã nhân viên!", "warning");
        return;
    }

    const assignedAreas = areasRaw.split('\n').map(a => a.trim()).filter(Boolean);

    const data = {
        fullName,
        staffCode,
        phone,
        assignedAreas,
        note,
        status,
        updatedAt: serverTimestamp()
    };

    try {
        if (id) {
            await updateDoc(doc(SmartCleanState.db, 'clean_staff', id), data);
            window.showToast("Đã cập nhật hồ sơ nhân viên thành công!", "success");
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(SmartCleanState.db, 'clean_staff'), data);
            window.showToast("Đã thêm hồ sơ nhân viên mới thành công!", "success");
        }
        window.closeStaffModal();
    } catch (e) {
        window.showToast("Lỗi lưu nhân viên: " + e.message, "error");
    }
};

// --- RECURRING TASKS CRUD ---
window.openAddRecurringTaskModal = () => {
    document.getElementById('scRecTaskModalTitle').innerText = "Thêm Công Việc Cố Định";
    document.getElementById('scRecTaskId').value = "";
    document.getElementById('scRecTaskTitle').value = "";
    document.getElementById('scRecTaskArea').value = "";
    document.getElementById('scRecTaskShiftTime').value = "";
    document.getElementById('scRecTaskDescription').value = "";
    document.getElementById('scRecTaskCriteria').value = "";
    document.getElementById('scRecTaskFreq').value = "daily";
    document.getElementById('scRecTaskStatus').value = "active";

    // Populate staff dropdown
    const staffSel = document.getElementById('scRecTaskStaff');
    staffSel.innerHTML = SmartCleanState.staffList.map(s => `<option value="${s.id}">${s.fullName} (${s.staffCode})</option>`).join('');

    document.getElementById('scRecurringTaskModal').classList.remove('hidden');
};

window.openEditRecurringTaskModal = (taskId) => {
    const t = SmartCleanState.recurringTasks.find(x => x.id === taskId);
    if (!t) return;
    document.getElementById('scRecTaskModalTitle').innerText = "Sửa Công Việc Cố Định";
    document.getElementById('scRecTaskId').value = t.id;
    document.getElementById('scRecTaskTitle').value = t.title || '';
    document.getElementById('scRecTaskArea').value = t.area || '';
    document.getElementById('scRecTaskShiftTime').value = t.shiftTime || '';
    document.getElementById('scRecTaskDescription').value = t.description || '';
    document.getElementById('scRecTaskCriteria').value = t.criteria || '';
    document.getElementById('scRecTaskFreq').value = t.frequency || 'daily';
    document.getElementById('scRecTaskStatus').value = t.status || 'active';

    const staffSel = document.getElementById('scRecTaskStaff');
    staffSel.innerHTML = SmartCleanState.staffList.map(s => `<option value="${s.id}" ${s.id === t.staffId ? 'selected' : ''}>${s.fullName} (${s.staffCode})</option>`).join('');

    document.getElementById('scRecurringTaskModal').classList.remove('hidden');
};

window.closeRecurringTaskModal = () => {
    document.getElementById('scRecurringTaskModal').classList.add('hidden');
};

window.saveRecurringTaskFromModal = async () => {
    const id = document.getElementById('scRecTaskId').value;
    const title = document.getElementById('scRecTaskTitle').value.trim();
    const staffId = document.getElementById('scRecTaskStaff').value;
    const area = document.getElementById('scRecTaskArea').value.trim();
    const frequency = document.getElementById('scRecTaskFreq').value;
    const shiftTime = document.getElementById('scRecTaskShiftTime').value.trim();
    const description = document.getElementById('scRecTaskDescription').value.trim();
    const criteria = document.getElementById('scRecTaskCriteria').value.trim();
    const status = document.getElementById('scRecTaskStatus').value;

    if (!title || !staffId) {
        window.showToast("Vui lòng nhập tên công việc và chọn nhân viên phụ trách!", "warning");
        return;
    }

    const staffObj = SmartCleanState.staffList.find(s => s.id === staffId);
    const staffName = staffObj ? staffObj.fullName : '';

    const data = {
        title,
        staffId,
        staffName,
        area,
        frequency,
        shiftTime,
        description,
        criteria,
        status,
        updatedAt: serverTimestamp()
    };

    try {
        if (id) {
            await updateDoc(doc(SmartCleanState.db, 'clean_recurring_tasks', id), data);
            window.showToast("Đã cập nhật công việc cố định!", "success");
        } else {
            data.createdAt = serverTimestamp();
            await addDoc(collection(SmartCleanState.db, 'clean_recurring_tasks'), data);
            window.showToast("Đã thêm công việc cố định mới!", "success");
        }
        window.closeRecurringTaskModal();
    } catch (e) {
        window.showToast("Lỗi lưu công việc cố định: " + e.message, "error");
    }
};

window.deleteRecurringTask = (taskId) => {
    window.confirmAction("Xóa công việc cố định", "Bạn có chắc chắn muốn xóa công việc này khỏi danh mục cố định của nhân viên?", async () => {
        try {
            await deleteDoc(doc(SmartCleanState.db, 'clean_recurring_tasks', taskId));
            window.showToast("Đã xóa công việc cố định thành công!", "success");
        } catch (e) {
            window.showToast("Lỗi xóa: " + e.message, "error");
        }
    });
};

// --- AD-HOC TASKS CRUD ---
window.openAddAdhocTaskModal = () => {
    document.getElementById('scAdhocTitle').value = "";
    document.getElementById('scAdhocArea').value = "";
    document.getElementById('scAdhocDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('scAdhocDueTime').value = "17:00";
    document.getElementById('scAdhocPriority').value = "Bình thường";
    document.getElementById('scAdhocContent').value = "";

    // Multi-select or checkboxes for staff
    const staffContainer = document.getElementById('scAdhocStaffCheckboxes');
    if (staffContainer) {
        staffContainer.innerHTML = SmartCleanState.staffList.filter(s => s.status === 'active').map(s => `
            <label class="flex items-center gap-2 p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" value="${s.id}" data-name="${s.fullName}" class="sc-adhoc-staff-cb rounded text-emerald-600 focus:ring-emerald-500">
                <span>👤 ${s.fullName}</span>
            </label>
        `).join('');
    }

    document.getElementById('scAdhocTaskModal').classList.remove('hidden');
};

window.closeAdhocTaskModal = () => {
    document.getElementById('scAdhocTaskModal').classList.add('hidden');
};

window.saveAdhocTaskFromModal = async () => {
    const title = document.getElementById('scAdhocTitle').value.trim();
    const area = document.getElementById('scAdhocArea').value.trim();
    const dueDate = document.getElementById('scAdhocDate').value;
    const dueTime = document.getElementById('scAdhocDueTime').value;
    const priority = document.getElementById('scAdhocPriority').value;
    const content = document.getElementById('scAdhocContent').value.trim();

    const selectedStaffCbs = Array.from(document.querySelectorAll('.sc-adhoc-staff-cb:checked'));
    if (!title || selectedStaffCbs.length === 0) {
        window.showToast("Vui lòng nhập tên công việc và chọn ít nhất một nhân viên!", "warning");
        return;
    }

    const staffIds = selectedStaffCbs.map(cb => cb.value);
    const staffNames = selectedStaffCbs.map(cb => cb.dataset.name);

    const data = {
        title,
        area,
        dueDate,
        dueTime,
        priority,
        content,
        staffIds,
        staffNames,
        status: "Chưa thực hiện",
        assignedDate: new Date().toISOString().split('T')[0],
        assignedBy: SmartCleanState.currentUserData?.displayName || 'Phó Trưởng Phòng',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    try {
        await addDoc(collection(SmartCleanState.db, 'clean_adhoc_tasks'), data);
        window.showToast("Đã giao việc phát sinh thành công!", "success");
        window.closeAdhocTaskModal();
    } catch (e) {
        window.showToast("Lỗi giao việc phát sinh: " + e.message, "error");
    }
};

window.markAdhocTaskDone = async (taskId) => {
    try {
        await updateDoc(doc(SmartCleanState.db, 'clean_adhoc_tasks', taskId), {
            status: "Đã hoàn thành",
            completedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        window.showToast("Đã nghiệm thu hoàn thành công việc phát sinh!", "success");
    } catch (e) {
        window.showToast("Lỗi nghiệm thu: " + e.message, "error");
    }
};

window.deleteAdhocTask = (taskId) => {
    window.confirmAction("Xóa việc phát sinh", "Bạn có chắc chắn muốn xóa công việc phát sinh này?", async () => {
        try {
            await deleteDoc(doc(SmartCleanState.db, 'clean_adhoc_tasks', taskId));
            window.showToast("Đã xóa việc phát sinh thành công!", "success");
        } catch (e) {
            window.showToast("Lỗi xóa: " + e.message, "error");
        }
    });
};

// --- INSPECTION DETAIL MODAL ---
window.viewInspectionDetail = (inspId) => {
    const i = SmartCleanState.inspections.find(x => x.id === inspId);
    if (!i) return;

    document.getElementById('scInspDetailStaff').innerText = i.staffName;
    document.getElementById('scInspDetailDate').innerText = `${i.inspectionDate} (${i.inspectionTime || 'Trong ngày'})`;
    document.getElementById('scInspDetailInspector').innerText = i.inspectorName || 'Giám sát';
    document.getElementById('scInspDetailRate').innerText = `${Math.round(i.passRate || 100)}% (${i.passedItems || 0}/${(i.totalItems || 0) - (i.notApplicableItems || 0)} việc đạt)`;
    document.getElementById('scInspDetailComment').innerText = i.generalComment || 'Không có nhận xét thêm.';

    const statusBadge = {
        'passed': '<span class="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">✓ Đạt</span>',
        'failed': '<span class="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-full text-[10px]">✗ Không đạt</span>',
        'not_done': '<span class="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">⏳ Chưa làm</span>',
        'not_applicable': '<span class="text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-full text-[10px]">\\ Miễn</span>'
    };

    const itemsContainer = document.getElementById('scInspDetailItems');
    if (itemsContainer) {
        itemsContainer.innerHTML = (i.items || []).map((it, idx) => `
            <div class="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-start justify-between gap-2 text-xs">
                <div>
                    <span class="font-bold text-slate-800">${idx + 1}. ${it.title}</span>
                    <p class="text-[11px] text-slate-500 mt-0.5">Khu vực: ${it.area || '-'}</p>
                    ${it.note ? `<p class="text-[11px] text-rose-600 font-medium mt-0.5">Lưu ý: ${it.note}</p>` : ''}
                </div>
                <div class="shrink-0 text-right">
                    ${statusBadge[it.status] || ''}
                    ${it.correctionRequired ? '<span class="block text-[9px] text-rose-600 font-extrabold mt-1">Cần khắc phục</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    const imgContainer = document.getElementById('scInspDetailImages');
    if (imgContainer) {
        if ((i.evidenceImages || []).length > 0) {
            imgContainer.innerHTML = i.evidenceImages.map(img => `
                <a href="${img}" target="_blank" class="block w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0">
                    <img src="${img}" alt="Minh chứng" class="w-full h-full object-cover hover:scale-105 transition-transform">
                </a>
            `).join('');
        } else {
            imgContainer.innerHTML = '<p class="text-xs text-slate-400 italic">Không có hình ảnh đính kèm.</p>';
        }
    }

    document.getElementById('scInspectionDetailModal').classList.remove('hidden');
};

window.closeInspectionDetailModal = () => {
    document.getElementById('scInspectionDetailModal').classList.add('hidden');
};

// --- KPI ADJUSTMENT & APPROVAL ---
window.openAdjustKpiModal = (staffId, monthYear) => {
    const s = SmartCleanState.staffList.find(x => x.id === staffId);
    const kpi = SmartCleanState.kpiEvaluations.find(k => k.staffId === staffId && k.monthYear === monthYear);
    if (!s) return;

    document.getElementById('scKpiModalStaffName').innerText = `${s.fullName} (${s.staffCode})`;
    document.getElementById('scKpiModalMonth').innerText = `Tháng ${monthYear}`;
    document.getElementById('scKpiStaffId').value = staffId;
    document.getElementById('scKpiMonthYear').value = monthYear;

    document.getElementById('scKpiScoreCompletion').value = kpi ? kpi.completionRate : 100;
    document.getElementById('scKpiScoreQuality').value = kpi ? kpi.qualityScore : 100;
    document.getElementById('scKpiScoreDiscipline').value = kpi ? kpi.disciplineScore : 100;
    document.getElementById('scKpiScoreSafety').value = kpi ? kpi.safetyComplianceScore : 100;
    document.getElementById('scKpiReason').value = "";

    document.getElementById('scKpiModal').classList.remove('hidden');
};

window.closeKpiModal = () => {
    document.getElementById('scKpiModal').classList.add('hidden');
};

window.saveKpiAdjustmentFromModal = async () => {
    const staffId = document.getElementById('scKpiStaffId').value;
    const monthYear = document.getElementById('scKpiMonthYear').value;
    const completion = parseFloat(document.getElementById('scKpiScoreCompletion').value) || 0;
    const quality = parseFloat(document.getElementById('scKpiScoreQuality').value) || 0;
    const discipline = parseFloat(document.getElementById('scKpiScoreDiscipline').value) || 0;
    const safety = parseFloat(document.getElementById('scKpiScoreSafety').value) || 0;
    const reason = document.getElementById('scKpiReason').value.trim();

    if (!reason) {
        window.showToast("Vui lòng ghi rõ lý do điều chỉnh điểm KPI!", "warning");
        return;
    }

    const weights = SmartCleanState.settings.weights || { completion: 40, quality: 40, discipline: 10, safety: 10 };
    const finalScore = Math.round(
        (completion * (weights.completion / 100)) +
        (quality * (weights.quality / 100)) +
        (discipline * (weights.discipline / 100)) +
        (safety * (weights.safety / 100))
    );

    let ranking = "Xuất sắc";
    if (finalScore < 50) ranking = "Yếu / Cần nhắc nhở";
    else if (finalScore < 65) ranking = "Trung bình";
    else if (finalScore < 80) ranking = "Khá";
    else if (finalScore < 90) ranking = "Tốt";

    const kpiDocId = `kpi_${staffId}_${monthYear}`;
    const staffObj = SmartCleanState.staffList.find(s => s.id === staffId);

    const adjustmentRecord = {
        adjustedBy: SmartCleanState.currentUserData?.displayName || 'Phó Trưởng Phòng',
        adjustedAt: new Date().toISOString(),
        reason: reason,
        newFinalScore: finalScore
    };

    try {
        const kpiRef = doc(SmartCleanState.db, 'clean_kpi_monthly', kpiDocId);
        const curDoc = await getDoc(kpiRef);
        const existingAdjustments = curDoc.exists() ? (curDoc.data().scoreAdjustments || []) : [];

        await setDoc(kpiRef, {
            staffId: staffId,
            staffName: staffObj ? staffObj.fullName : '',
            monthYear: monthYear,
            completionRate: completion,
            qualityScore: quality,
            disciplineScore: discipline,
            safetyComplianceScore: safety,
            weights: weights,
            finalKpiScore: finalScore,
            ranking: ranking,
            scoreAdjustments: [...existingAdjustments, adjustmentRecord],
            updatedAt: serverTimestamp()
        }, { merge: true });

        window.showToast("Đã lưu điều chỉnh điểm KPI và nhật ký thành công!", "success");
        window.closeKpiModal();
    } catch (e) {
        window.showToast("Lỗi điều chỉnh KPI: " + e.message, "error");
    }
};

window.approveKpiResult = async (kpiId) => {
    window.confirmAction("Xác nhận duyệt KPI", "Trưởng phòng xác nhận kết quả đánh giá KPI này?", async () => {
        try {
            await updateDoc(doc(SmartCleanState.db, 'clean_kpi_monthly', kpiId), {
                managerApproval: {
                    approved: true,
                    approvedBy: SmartCleanState.currentUserData?.displayName || 'Trưởng Phòng',
                    approvedAt: new Date().toISOString()
                },
                updatedAt: serverTimestamp()
            });
            window.showToast("Đã duyệt kết quả KPI thành công!", "success");
        } catch (e) {
            window.showToast("Lỗi duyệt KPI: " + e.message, "error");
        }
    });
};
