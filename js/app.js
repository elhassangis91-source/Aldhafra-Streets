// 1. تعريف المتغيرات العامة
let map, allStreetsLayer, geojsonData;

// 2. دالة فتح التبويبات (Tabs) - لازم تكون window عشان الـ HTML يشوفها
window.openTab = function(tabId, event) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
};

// 3. تشغيل الخريطة والبيانات عند تحميل الصفحة
window.onload = function() {
    // إنشاء الخريطة
    map = L.map('map').setView([23.65, 53.70], 9);

    // إضافة خريطة جوجل
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    // تحميل البيانات (Fetch)
    fetch(`data/AllStreets.json?v=${new Date().getTime()}`)
        .then(res => res.json())
        .then(data => {
            geojsonData = data;
            
            // رسم الشوارع على الخريطة
            allStreetsLayer = L.geoJSON(data, {
                style: { color: "#1a2a6c", weight: 2, opacity: 0.6 },
                onEachFeature: function(feature, layer) {
                    layer.bindPopup(`<b>${feature.properties.Name_Ar}</b>`);
                    layer.on('click', () => highlightStreet(layer));
                }
            }).addTo(map);

            // عرض عينة بسيطة في القائمة أول ما يفتح (عشان السرعة)
            renderList(data.features.slice(0, 15));
            document.getElementById('stats').innerText = `تم تحميل ${data.features.length} شارع`;
        });
};

// 4. دالة البحث السلسة (اللي اتكلمنا عنها)
document.getElementById('searchBox').addEventListener('input', function() {
    if (!geojsonData) return;

    const value = this.value.toLowerCase().trim();

    // لو البحث فاضي، اعرض عينة بسيطة
    if (value === "") {
        renderList(geojsonData.features.slice(0, 15));
        return;
    }

    // الفلترة اللحظية
    const filtered = geojsonData.features.filter(f => {
        const name = (f.properties.Name_Ar || "").toLowerCase();
        const id = String(f.properties.RoadID);
        return name.includes(value) || id.includes(value);
    });

    // عرض النتايج (بحد أقصى 100 عشان الجهاز ما يهنجش)
    renderList(filtered.slice(0, 100));
});

// 5. دالة إنشاء القائمة
function renderList(features) {
    const list = document.getElementById('resultsList');
    if (!list) return;
    list.innerHTML = '';
    
    features.forEach(f => {
        const div = document.createElement('div');
        div.className = 'street-item';
        div.innerHTML = `<b>${f.properties.Name_Ar}</b><br><small>ID: ${f.properties.RoadID}</small>`;
        
        div.onclick = () => {
            allStreetsLayer.eachLayer(l => {
                if (String(l.feature.properties.RoadID) === String(f.properties.RoadID)) {
                    highlightStreet(l);
                    map.fitBounds(l.getBounds(), { maxZoom: 18 });
                }
            });
        };
        list.appendChild(div);
    });
}

// 6. دالة تمييز الشارع (Highlight)
function highlightStreet(layer) {
    allStreetsLayer.eachLayer(l => l.setStyle({ color: "#1a2a6c", weight: 2 }));
    layer.setStyle({ color: "red", weight: 6 }).bringToFront();
}

// 5. محرك الذكاء الاصطناعي (AI Engine)
function addMessage(text, side) {
    const box = document.getElementById('chat-box');
    const msg = document.createElement('div');
    msg.className = side + '-msg';
    msg.innerText = text;
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
}

function processAI(query) {
    const q = query.trim().toLowerCase();
    
    // أ- الرد على التحية
    const greetings = ["مرحبا", "اهلا", "السلام عليكم", "صباح الخير", "هلا"];
    if (greetings.some(g => q.includes(g))) {
        addMessage("أهلاً بك في منصة الظفرة الذكية! كيف يمكنني مساعدتك في البحث عن الشوارع اليوم؟", "bot");
        return;
    }

    // ب- البحث عن شارع معين عبر الـ AI
    const found = geojsonData.features.find(f => q.includes(f.properties.Name_Ar.toLowerCase()));
    if (found) {
        addMessage(`وجدت لك ${found.properties.Name_Ar}. جاري تحديده على الخريطة...`, "bot");
        allStreetsLayer.eachLayer(l => {
            if (l.feature.properties.RoadID === found.properties.RoadID) {
                highlightStreet(l);
                map.flyToBounds(l.getBounds(), { maxZoom: 17 });
            }
        });
    } else {
        addMessage("عذراً، لم أجد شارعاً بهذا الاسم. يرجى كتابة اسم الشارع بشكل صحيح.", "bot");
    }
}

// 6. تشغيل واجهة الدردشة عند التحميل
document.addEventListener('DOMContentLoaded', () => {
    const sendBtn = document.getElementById('send-ai-btn');
    const input = document.getElementById('ai-input');

    if (sendBtn && input) {
        sendBtn.onclick = () => {
            if (input.value.trim()) {
                addMessage(input.value, "user");
                processAI(input.value);
                input.value = '';
            }
        };
        input.onkeypress = (e) => { if (e.key === 'Enter') sendBtn.click(); };
    }
});

// دالة تنظيف النص العربي
function normalizeArabic(text) {
    if (!text) return "";
    return text.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
}
