// 1. نظام التبويبات (Tabs) - لضمان العمل من الـ HTML
window.openTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) selectedTab.classList.add('active');
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
};

// 2. إعداد الخريطة والبيز ماب (على الشمال)
const baseMaps = {
    "Google Maps": L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }),
    "Imagery": L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0', 'mt1', 'mt2', 'mt3'] }),
    "Light Gray": L.tileLayer('https://Basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 })
};

const map = L.map('map', { center: [23.65, 53.70], zoom: 9, layers: [baseMaps["Google Maps"]] });
L.control.layers(baseMaps, null, { position: 'topleft' }).addTo(map);

let allStreetsLayer, geojsonData, lastSelectedStreet = null;

// 3. جلب البيانات (Fetch)
fetch(`data/AllStreets.json?v=${new Date().getTime()}`)
    .then(r => r.json())
    .then(data => {
        geojsonData = data;
        allStreetsLayer = L.geoJSON(data, {
            onEachFeature: function(feature, layer) {
                layer.setStyle({ color: "#1a2a6c", weight: 40, opacity: 0 });
                const vLine = L.polyline(layer.getLatLngs(), { color: "#1a2a6c", weight: 2, opacity: 0.6, interactive: false }).addTo(map);
                layer.visibleLine = vLine;
                layer.on('click', () => highlightStreet(layer));
            }
        }).addTo(map);
        renderList(data.features);
        document.getElementById('stats').innerText = `تم تحميل ${data.features.length} شارعاً`;
    })
    .catch(err => console.error("Error loading JSON:", err));

// 4. وظائف البحث والقائمة
function renderList(features) {
    const list = document.getElementById('resultsList');
    if (!list) return;
    list.innerHTML = '';
    features.slice(0, 100).forEach(f => {
        const div = document.createElement('div');
        div.className = 'street-item';
        div.innerHTML = `<b>${f.properties.Name_Ar}</b><br><small>ID: ${f.properties.RoadID}</small>`;
        div.onclick = () => {
            allStreetsLayer.eachLayer(l => {
                if (String(l.feature.properties.RoadID) === String(f.properties.RoadID)) {
                    highlightStreet(l);
                    map.flyToBounds(l.getBounds(), { maxZoom: 18 });
                }
            });
        };
        list.appendChild(div);
    });
}

function highlightStreet(layer) {
    allStreetsLayer.eachLayer(l => { if (l.visibleLine) l.visibleLine.setStyle({ color: "#1a2a6c", weight: 2, opacity: 0.6 }); });
    if (layer.visibleLine) layer.visibleLine.setStyle({ color: "#ff0000", weight: 6, opacity: 1 }).bringToFront();
    layer.openPopup();
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
