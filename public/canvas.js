// public/canvas.js
import { generateBlockContent } from './api.js';

let activeCanvasItem = null;
let dragSourceItem = null;
let uiElements = {};

// --- YENİ: BEDAVA VE SINIRSIZ SES MOTORU (Web Speech API) ---
function addAudioSupport(item, contentDiv, type) {
    // Sadece okunabilir bloklara (Metin ve Soru) ses butonu ekliyoruz
    if (type === 'text' || type.startsWith('quiz')) {
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '🔊';
        playBtn.title = 'Sesli Oku / Durdur';
        // Çöp kutusunun hemen yanına yerleştiriyoruz
        playBtn.style.cssText = "position: absolute; top: 5px; right: 35px; background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 14px; z-index: 10; transition: 0.2s;";
        
        playBtn.onmouseover = () => playBtn.style.transform = "scale(1.1)";
        playBtn.onmouseout = () => playBtn.style.transform = "scale(1)";

        playBtn.onclick = (e) => {
            e.stopPropagation(); // Tuvale tıklama olayını (seçmeyi) engelleme
            
            if (!('speechSynthesis' in window)) {
                return alert("Tarayıcınız sesli okumayı desteklemiyor.");
            }
            
            // Eğer o an konuşuyorsa sustur
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            } else {
                // Konuşmuyorsa, kutunun içindeki metni alıp okut
                let textToRead = contentDiv.innerText.replace('🔊', '').replace('×', ''); // Butonları okumasın
                const utterance = new SpeechSynthesisUtterance(textToRead);
                utterance.lang = 'tr-TR'; // Türkçe telaffuz
                utterance.rate = 0.9; // Biraz yavaş ve tane tane okusun
                speechSynthesis.speak(utterance);
            }
        };
        item.appendChild(playBtn);
    }
}
// -----------------------------------------------------------

// Tuvali başlatan ana fonksiyon
export function initCanvasCore(elements) {
    uiElements = elements;

    uiElements.canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        uiElements.canvas.style.backgroundColor = "#f0fdf4";
    });

    uiElements.canvas.addEventListener('dragleave', () => {
        uiElements.canvas.style.backgroundColor = "white";
    });

    uiElements.canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        uiElements.canvas.style.backgroundColor = "white";
        if (uiElements.emptyState) uiElements.emptyState.style.display = 'none';

        const type = e.dataTransfer.getData('type');
        const name = e.dataTransfer.getData('name');
        if (type) createCanvasItem(type, name);
    });

    uiElements.canvas.addEventListener('click', () => {
        if (activeCanvasItem) activeCanvasItem.classList.remove('active');
        activeCanvasItem = null;
        uiElements.noSelectionMsg.style.display = 'block';
        uiElements.aiControls.style.display = 'none';
    });
}

// Seçili öğeyi dışarıdan okumak için
export function getActiveCanvasItem() {
    return activeCanvasItem;
}

// Arayüze yeni kutu ekleyen fonksiyon
export function createCanvasItem(type, name) {
    const item = document.createElement('div');
    item.classList.add('canvas-item', 'w-full');
    item.setAttribute('data-type', type);
    
    const delBtn = document.createElement('button');
    delBtn.innerHTML = '×';
    delBtn.className = 'delete-btn';
    delBtn.onclick = (e) => { e.stopPropagation(); item.remove(); };
    item.appendChild(delBtn);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'item-body';
    contentDiv.innerHTML = `<span style="color: #999;">[Boş ${name}] - Üretmek için tıklayın.</span>`;
    item.appendChild(contentDiv);

    addAudioSupport(item, contentDiv, type);

    if (type === 'text') {
        contentDiv.setAttribute('contenteditable', 'true');
        contentDiv.style.outline = 'none';
        contentDiv.style.cursor = 'text';
    }

    item.onclick = (e) => {
        e.stopPropagation();
        selectItem(item, type, name);
    };

    uiElements.canvas.appendChild(item);
    addReorderEvents(item);
}

// Blok sıralama motoru
function addReorderEvents(item) {
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', (e) => {
        if (item.classList.contains('canvas-item')) {
            dragSourceItem = item;
            item.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
        }
    });
    item.addEventListener('dragend', () => {
        item.style.opacity = '1';
        uiElements.canvas.classList.remove('drag-over-active');
    });
    item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSourceItem && dragSourceItem !== item) {
            const bounding = item.getBoundingClientRect();
            if (e.clientY > bounding.top + bounding.height / 2) {
                item.parentNode.insertBefore(dragSourceItem, item.nextSibling);
            } else {
                item.parentNode.insertBefore(dragSourceItem, item);
            }
        }
    });
}

// Kutu seçme motoru
function selectItem(item, type, name) {
    if (activeCanvasItem) activeCanvasItem.classList.remove('active');
    activeCanvasItem = item;
    activeCanvasItem.classList.add('active');

    uiElements.noSelectionMsg.style.display = 'none';
    uiElements.aiControls.style.display = 'block';
    uiElements.selectedTypeBadge.innerText = `Seçilen: ${name}`;

    const sizeControls = `
        <div style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;">
            <label style="font-size:12px; font-weight:bold;">Blok Genişliği:</label>
            <div style="display:flex; gap:5px; margin-top:5px;">
                <button onclick="window.updateWidth('full')" style="flex:1; font-size:11px;">Tam</button>
                <button onclick="window.updateWidth('half')" style="flex:1; font-size:11px;">1/2</button>
                <button onclick="window.updateWidth('third')" style="flex:1; font-size:11px;">1/3</button>
            </div>
        </div>
    `;
    if (!document.getElementById('size-control-wrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'size-control-wrap';
        wrap.innerHTML = sizeControls;
        uiElements.aiControls.appendChild(wrap);
    }
}

// Global genişlik güncelleme
window.updateWidth = (size) => {
    const activeItem = document.querySelector('.canvas-item.active');
    if (!activeItem) return;
    activeItem.classList.remove('w-full', 'w-half', 'w-third');
    activeItem.classList.add('w-' + size);
};

// Arkadaşının Mükemmel Orkestratör Render Fonksiyonu
export async function renderPageFromJSON(plan) {
    uiElements.canvas.innerHTML = ''; 
    if (uiElements.emptyState) uiElements.emptyState.style.display = 'none';

    for (const row of plan.layout) {
        const rowDiv = document.createElement("div");
        rowDiv.style.display = "flex";
        rowDiv.style.gap = "15px";
        rowDiv.style.marginBottom = "15px";
        rowDiv.style.width = "100%";

        for (const block of row.children) {
            const repeat = block.count || 1;
            for (let i = 0; i < repeat; i++) {
                const type = block.type;
                let name = type === "text" ? "Metin Bloğu" : type === "image" ? "AI Görsel" : "AI Soru Seti";

                const item = document.createElement('div');
                item.classList.add('canvas-item');
                item.style.flex = "1"; 
                item.setAttribute('data-type', type);

                const delBtn = document.createElement('button');
                delBtn.innerHTML = '×';
                delBtn.className = 'delete-btn';
                delBtn.onclick = (e) => { e.stopPropagation(); item.remove(); };
                item.appendChild(delBtn);

                const contentDiv = document.createElement('div');
                contentDiv.className = 'item-body';
                contentDiv.innerHTML = `<span style="color: #666; font-style: italic;">⏳ Yapay Zeka Çiziyor...</span>`;
                item.appendChild(contentDiv);
                addAudioSupport(item, contentDiv, type);

                if (type === 'text') {
                    contentDiv.setAttribute('contenteditable', 'true');
                    contentDiv.style.outline = 'none';
                    contentDiv.style.cursor = 'text';
                }

                item.onclick = (e) => { e.stopPropagation(); selectItem(item, type, name); };
                addReorderEvents(item);
                rowDiv.appendChild(item);

                await generateContent(contentDiv, block);
            }
        }
        uiElements.canvas.appendChild(rowDiv);
    }
}

// Arkadaşının Geliştirdiği İçerik Üretme Fonksiyonu
export async function generateContent(container, block) {
    try {
        let type = block.type;
        let prompt = block.content || block.prompt || "Bu konu hakkında açıklayıcı içerik üret.";

        if (type && type.startsWith("quiz")) {
            type = "quiz";
            if (block.type === "quiz-mcq") prompt += " 4 şıklı çoktan seçmeli, farklı bir soru üret.";
            if (block.type === "quiz-fill") prompt += " Boşluk doldurma formatında, farklı bir soru üret.";
            if (block.type === "quiz-truefalse") prompt += " Doğru/Yanlış formatında, farklı bir soru üret.";
            if (block.type === "quiz-short") prompt += " Kısa cevaplı, farklı bir soru üret.";
        }

        const data = await generateBlockContent(prompt, type, block.type);

        if (data.status === "SUCCESS") {
            if (data.type === "html") {
                container.innerHTML = data.content;
            } else {
                container.innerText = data.content;
            }
        } else if (data.status === "NO_ACTION") {
            let formattedText = data.message.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
            container.innerHTML = `<div style="line-height:1.6;color:#333;">${formattedText}</div>`;
        } else {
            container.innerHTML = `<span style="color:red;">🚨 ${data.message || 'Bilinmeyen Hata'}</span>`;
        }
    } catch (err) {
        container.innerHTML = `<span style="color: red;">❌ İnternet veya bağlantı hatası</span>`;
    }
}