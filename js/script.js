// 記録を格納する配列
let records = [];
let filteredRecords = []; // フィルタリング後の一覧
// Undo 履歴スタック（records のスナップショット）
let undoStack = [];
const UNDO_LIMIT = 20;

// 統計・分析
function updateStatistics() {
    if (records.length === 0) {
        const setIfExists = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };

        setIfExists('average-mood', '-');
        setIfExists('total-records', '0');
        setIfExists('max-mood', '-');
        setIfExists('min-mood', '-');
        const distEl = document.getElementById('mood-distribution');
        if (distEl) distEl.innerHTML = '<p style="color: #999;">データがありません</p>';
        return;
    }
    
    // 平均を計算
    const sum = records.reduce((acc, record) => acc + record.mood, 0);
    const average = (sum / records.length).toFixed(2);
    document.getElementById('average-mood').textContent = average;
    
    // 総記録数
    document.getElementById('total-records').textContent = records.length;
    
    // 最頻値（モード）と標準偏差（ばらつき）
    const moods = records.map(r => r.mood);
    // モードを計算
    const freq = {};
    moods.forEach(m => { freq[m] = (freq[m] || 0) + 1; });// 頻度を数える
    let mode = '-';
    let maxCount = 0;
    Object.keys(freq).forEach(k => {
        if (freq[k] > maxCount) {
            maxCount = freq[k];
            mode = k;
        }
    });
    document.getElementById('mode-mood').textContent = mode;

    // 標準偏差（母分散から計算）
    const mean = sum / records.length;
    const variance = records.reduce((acc, r) => acc + Math.pow(r.mood - mean, 2), 0) / records.length;// 母分散
    const stddev = Math.sqrt(variance);
    document.getElementById('stddev-mood').textContent = stddev.toFixed(2);// 小数点以下2桁まで表示
    
    // 気分分布グラフ
    const distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    records.forEach(record => {
        distribution[record.mood]++;
    });
    
    let chartHTML = '<div class="chart-bars">';
    for (let i = 1; i <= 5; i++) {
        const count = distribution[i];
        const maxCount = Math.max(...Object.values(distribution));// 最大値を取得
        const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;// 幅の割合
        
        chartHTML += `
            <div class="chart-bar-item">
                <div class="chart-label">${i}</div>
                <div class="chart-bar-container">
                    <div class="chart-bar" style="width: ${percentage}%; background-color: ${getMoodColor(i)};">
                        <span class="chart-value">${count}</span>
                    </div>
                </div>
            </div>
        `;
    }
    chartHTML += '</div>';
    document.getElementById('mood-distribution').innerHTML = chartHTML;
}

// 気分評価に応じた色を返す
function getMoodColor(mood) {
    const colors = {
        1: '#e74c3c', // 赤
        2: '#f39c12', // オレンジ
        3: '#f1c40f', // 黄
        4: '#2ecc71', // 緑
        5: '#3498db'  // 青
    };
    return colors[mood] || '#95a5a6';
}

// フィルタとソート
function filterAndSortRecords() {
    let filtered = [...records];
    
    // テキスト検索
    const searchText = document.getElementById('search-text').value.toLowerCase().trim();
    if (searchText) {
        filtered = filtered.filter(record => 
            record.content.toLowerCase().includes(searchText)//大文字小文字を区別しない検索
        );
    }
    
    // 気分評価で絞り込む
    const filterMood = document.getElementById('filter-mood').value;
    if (filterMood) {
        filtered = filtered.filter(record => record.mood === parseInt(filterMood));
    }
    
    // 日付範囲で絞り込む
    const dateFrom = document.getElementById('date-from').value;
    const dateTo = document.getElementById('date-to').value;
    if (dateFrom) {
        filtered = filtered.filter(record => record.date >= dateFrom);
    }
    if (dateTo) {
        filtered = filtered.filter(record => record.date <= dateTo);
    }
    
    // ソート処理
    const sortBy = document.getElementById('sort-by').value;
    filtered.sort((a, b) => {
        switch(sortBy) {
            case 'date-desc':
                return new Date(b.date + ' ' + (b.time || '00:00')) - new Date(a.date + ' ' + (a.time || '00:00'));
            case 'date-asc':
                return new Date(a.date + ' ' + (a.time || '00:00')) - new Date(b.date + ' ' + (b.time || '00:00'));
            case 'mood-desc':
                return b.mood - a.mood;
            case 'mood-asc':
                return a.mood - b.mood;
            default:
                return 0;
        }
    });
    
    filteredRecords = filtered;
    return filtered;
}

// ユニークIDを生成
function generateId() {
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);// 形式：タイムスタンプ(36進数)-ランダム文字列
}

// 完了/未完了を切り替える
function toggleCompleted(index) {
    const recordToToggle = filteredRecords[index];
    let originalIndex = -1;
    if (recordToToggle.id) {
        originalIndex = records.findIndex(r => r.id === recordToToggle.id);
    } else {
        originalIndex = records.findIndex(r => 
            r.date === recordToToggle.date && 
            r.time === recordToToggle.time && 
            r.content === recordToToggle.content
        );
    }

    if (originalIndex !== -1) {
        pushHistory();
        records[originalIndex].completed = !records[originalIndex].completed;
        localStorage.setItem('moodRecords', JSON.stringify(records));
        console.log('記録の完了フラグを切替しました:', records[originalIndex]);
        displayRecords();
    }
}

// 編集用の状態
let currentEditOriginalIndex = null;

// 編集モーダルを開く（filteredRecords のインデックスを渡す）
function openEditModal(filteredIndex) {
    const recordToEdit = filteredRecords[filteredIndex];
    const originalIndex = records.findIndex(r => 
        r.date === recordToEdit.date && 
        r.time === recordToEdit.time && 
        r.content === recordToEdit.content
    );
    if (originalIndex === -1) return;
    currentEditOriginalIndex = originalIndex;

    // フォームに値をセット
    document.getElementById('edit-date').value = records[originalIndex].date || '';
    document.getElementById('edit-content').value = records[originalIndex].content || '';
    document.getElementById('edit-mood').value = records[originalIndex].mood || '';
    document.getElementById('edit-completed').checked = !!records[originalIndex].completed;

    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
    currentEditOriginalIndex = null;
}

// id 指定で編集モーダルを開く（index.html?editId=... に対応）
function openEditModalById(id) {
    const originalIndex = records.findIndex(r => r.id === id);
    if (originalIndex === -1) return;
    currentEditOriginalIndex = originalIndex;
    document.getElementById('edit-date').value = records[originalIndex].date || '';
    document.getElementById('edit-content').value = records[originalIndex].content || '';
    document.getElementById('edit-mood').value = records[originalIndex].mood || '';
    document.getElementById('edit-completed').checked = !!records[originalIndex].completed;
    document.getElementById('edit-modal').style.display = 'flex';
}

// Undo 用の履歴操作
function pushHistory() {
    try {
        // スナップショットを保存（深いコピー）
        const snapshot = JSON.parse(JSON.stringify(records));
        undoStack.push(snapshot);
        if (undoStack.length > UNDO_LIMIT) undoStack.shift();// 古い履歴を削除
    } catch (e) {
        console.error('履歴保存に失敗しました', e);
    }
    updateUndoButtonState();
}

function updateUndoButtonState() {
    const btn = document.getElementById('undo-button');
    if (!btn) return;
    btn.disabled = undoStack.length === 0;
}

function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack.pop();
    records = prev || [];
    localStorage.setItem('moodRecords', JSON.stringify(records));
    updateStatistics();
    displayRecords();
    updateUndoButtonState();
}

// フェーズ8: 削除機能
function deleteRecord(index) {
    // filteredRecordsのインデックスから元のrecordsのインデックスを取得
    const recordToDelete = filteredRecords[index];
    let originalIndex = -1;
    if (recordToDelete.id) {
        originalIndex = records.findIndex(r => r.id === recordToDelete.id);
    } else {
        originalIndex = records.findIndex(r => 
            r.date === recordToDelete.date && 
            r.time === recordToDelete.time && 
            r.content === recordToDelete.content
        );
    }
    
    if (originalIndex !== -1) {
        pushHistory();
        // フェーズ8: 削除時に配列を更新
        records.splice(originalIndex, 1);
        console.log('記録を削除しました。インデックス:', originalIndex);
        
        // フェーズ8: 削除後の内容をlocalStorageに保存
        localStorage.setItem('moodRecords', JSON.stringify(records));
        console.log('削除後のデータをlocalStorageに保存しました');
        
        // 統計と画面を再表示
        updateStatistics();
        displayRecords();
    }
}

// フェーズ4: 配列の内容を画面に表示する関数
function displayRecords() {
    const recordsList = document.getElementById('records-list');
    const recordsCount = document.getElementById('records-count');
    
    // フィルタリングとソートを適用
    const displayRecords = filterAndSortRecords();
    
    // フェーズ9: 記録件数を表示（全体と表示中の件数）
    if (recordsCount) {
        recordsCount.textContent = `記録件数: ${records.length}件（表示: ${displayRecords.length}件）`;
    }
    
    // 表示エリアをクリア
    recordsList.innerHTML = '';
    
    // フェーズ4: forEachを使って配列の内容を表示
    // 表示する記録がない場合のメッセージ
    if (displayRecords.length === 0) {
        recordsList.innerHTML = '<p style="color: #999; font-style: italic; padding: 20px; text-align: center;">該当する記録がありません。</p>';
        return;
    }
    
    displayRecords.forEach(function(record, index) {
        // 記録要素を作成
        const recordElement = document.createElement('div');
        recordElement.className = 'record-item';
        if (record.completed) {
            recordElement.classList.add('record-completed');
        }
        
        // 気分評価を星で表示
        let moodStars = '';
        for (let i = 0; i < record.mood; i++) {
            moodStars += '★';
        }
        
        // 日付をフォーマット（YYYY-MM-DD → YYYY年MM月DD日）
        const dateObj = new Date(record.date + 'T00:00:00');
        const formattedDate = dateObj.getFullYear() + '年' + 
                              (dateObj.getMonth() + 1) + '月' + 
                              dateObj.getDate() + '日';
        
        // 時刻を表示（時刻が記録されている場合）
        let timeDisplay = '';
        if (record.time) {
            timeDisplay = ` ${record.time}`;
        }
        
        // 検索語をハイライト
        let contentDisplay = record.content;
        const searchText = document.getElementById('search-text').value.trim();
        if (searchText) {
            const regex = new RegExp(`(${searchText})`, 'gi');
            contentDisplay = contentDisplay.replace(regex, '<mark>$1</mark>');
        }
        
        recordElement.innerHTML = `
            <div class="record-header">
                <input type="checkbox" class="completed-toggle" data-index="${index}" ${record.completed ? 'checked' : ''}>
                <div class="record-date">${formattedDate}${timeDisplay}</div>
                <div>
                    <a class="detail-button" href="detail.html?id=${record.id}">詳細</a>
                    <button class="edit-button" data-index="${index}">編集</button>
                    <button class="delete-button" data-index="${index}">削除</button>
                </div>
            </div>
            <div class="record-content">${contentDisplay}</div>
            <div class="record-mood">気分: ${moodStars} (${record.mood}/5)</div>
        `;
        
        recordsList.appendChild(recordElement);
    });
    
    // フェーズ8: 削除ボタンにイベントリスナーを設定
    const deleteButtons = recordsList.querySelectorAll('.delete-button');
    deleteButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const index = parseInt(button.getAttribute('data-index'));
            if (confirm('この記録を削除してもよろしいですか？')) {
                deleteRecord(index);
            }
        });
    });

    // フェーズ10: 完了トグルのイベントリスナーを設定
    const completedToggles = recordsList.querySelectorAll('.completed-toggle');
    completedToggles.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            const index = parseInt(checkbox.getAttribute('data-index'));
            toggleCompleted(index);
        });
    });

    // 編集ボタンイベント
    const editButtons = recordsList.querySelectorAll('.edit-button');
    editButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            const index = parseInt(button.getAttribute('data-index'));
            openEditModal(index);
        });
    });
    
    console.log('記録一覧を表示しました（全体: ' + records.length + '件、表示: ' + displayRecords.length + '件）');
}

// フェーズ2: ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('ページが読み込まれました');
    
    // フェーズ9: 日付を自動で追加
    const dateInput = document.getElementById('record-date');
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}-${month}-${day}`;
    dateInput.value = todayString;
    console.log('今日の日付を自動入力しました:', todayString);
    
    // フェーズ6: ページ読み込み時にlocalStorageからデータを取得
    const savedRecords = localStorage.getItem('moodRecords');
    if (savedRecords) {
        try {
            records = JSON.parse(savedRecords);
            // 既存データで id がないものには付与
            let changed = false;
            records.forEach(function(r) {
                if (!r.id) {
                    r.id = generateId();
                    changed = true;
                }
            });
            if (changed) {
                localStorage.setItem('moodRecords', JSON.stringify(records));
            }
            console.log('localStorageからデータを読み込みました:', records);
            
            // フェーズ6: データがあれば配列に代入（既に代入済み）、初期表示として一覧を表示
            updateStatistics();
            displayRecords();
        } catch (e) {
            console.error('データの読み込みに失敗しました:', e);
            records = [];
            displayRecords();
        }
    } else {
        console.log('保存されたデータはありません');
        updateStatistics();
        displayRecords();
    }

    // 起動時に ?editId=ID があれば編集モーダルを自動で開く
    const startParams = new URLSearchParams(window.location.search);
    const editIdParam = startParams.get('editId');
    if (editIdParam) {
        // 少し遅らせて DOM の表示が安定してから開く
        setTimeout(function() {
            openEditModalById(editIdParam);
        }, 150);
    }
    
    // フェーズ2: フォーム要素の取得
    const recordForm = document.getElementById('record-form');
    const addButton = document.getElementById('add-button');
    const recordCompleted = document.getElementById('record-completed');
    console.log('フォームを取得しました:', recordForm);
    console.log('ボタンを取得しました:', addButton);
    
    // フェーズ2: フォーム送信イベントとボタンクリックイベントの設定
    // HTML5のrequired属性を使うため、フォーム送信イベントを使用
    recordForm.addEventListener('submit', function(e) {
        // ネイティブの入力検証を優先する
        if (!recordForm.checkValidity()) {
            recordForm.reportValidity();
            return;
        }
        e.preventDefault(); // フォームのデフォルト送信を防ぐ
        console.log('フォームが送信されました');
        
        // フェーズ2: 入力欄の値を取得
        const contentInput = document.getElementById('record-content');
        const moodInput = document.getElementById('record-mood');
        
        const dateValue = dateInput.value;
        const contentValue = contentInput.value.trim(); // 前後の空白を削除
        const moodValue = moodInput.value;
        const completedValue = recordCompleted ? recordCompleted.checked : false;
        
        console.log('取得した値:');
        console.log('日付:', dateValue);
        console.log('内容:', contentValue);
        console.log('気分評価:', moodValue);
        
        // フェーズ9: 空入力を防ぐチェック（HTML5のrequired属性が基本チェックを担当）
        // さらに詳細なチェックを追加
        if (!dateValue) {
            alert('日付を入力してください');
            dateInput.focus();
            return;
        }
        
        if (!contentValue) {
            alert('内容を入力してください');
            contentInput.focus();
            return;
        }
        
        if (!moodValue) {
            alert('気分評価を選択してください');
            moodInput.focus();
            return;
        }
        
        // フェーズ9: 日付や時刻を自動で追加（時刻を取得）
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        
        // フェーズ3: 入力値をオブジェクトとして配列に追加
        const newRecord = {
            id: generateId(),
            date: dateValue,
            time: timeString, // フェーズ9: 時刻を追加
            content: contentValue,
            mood: parseInt(moodValue),
            completed: completedValue
        };
        // 追加前に履歴に保存
        pushHistory();
        records.push(newRecord);
        
        // フェーズ3: 配列の中身をconsole.logで確認
        console.log('記録を追加しました');
        console.log('現在の記録一覧:', records);
        
        // フェーズ5: localStorageにデータを保存
        localStorage.setItem('moodRecords', JSON.stringify(records));
        console.log('localStorageにデータを保存しました');
        
        // 統計と表示を更新
        updateStatistics();
        displayRecords();
        
        // フェーズ3: 入力後に入力欄を空にする（日付は今日の日付に戻す）
        dateInput.value = todayString;
        contentInput.value = '';
        moodInput.value = '';
        if (recordCompleted) recordCompleted.checked = false;
        
        console.log('入力欄をクリアしました');
    });
    
    // ボタンクリックはデフォルトの submit を利用する（重複呼び出しを避ける）
    
    // フィルタリング・検索のイベントリスナー
    document.getElementById('search-text').addEventListener('input', displayRecords);
    document.getElementById('filter-mood').addEventListener('change', displayRecords);
    document.getElementById('date-from').addEventListener('change', displayRecords);
    document.getElementById('date-to').addEventListener('change', displayRecords);
    document.getElementById('sort-by').addEventListener('change', displayRecords);
    
    // フィルタをクリア
    document.getElementById('clear-filters').addEventListener('click', function() {
        document.getElementById('search-text').value = '';
        document.getElementById('filter-mood').value = '';
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        document.getElementById('sort-by').value = 'date-desc';
        displayRecords();
    });

    // 編集モーダルのイベントハンドラ
    const editForm = document.getElementById('edit-form');
    const editCancel = document.getElementById('edit-cancel');
    const editModal = document.getElementById('edit-modal');
    if (editForm) {
        editForm.addEventListener('submit', function(e) {
            if (!editForm.checkValidity()) {
                editForm.reportValidity();
                return;
            }
            e.preventDefault();
            if (currentEditOriginalIndex === null) return;

            const dateVal = document.getElementById('edit-date').value;
            const contentVal = document.getElementById('edit-content').value.trim();
            const moodVal = document.getElementById('edit-mood').value;
            const completedVal = document.getElementById('edit-completed').checked;

            // 更新
            pushHistory();
            records[currentEditOriginalIndex].date = dateVal;
            records[currentEditOriginalIndex].content = contentVal;
            records[currentEditOriginalIndex].mood = parseInt(moodVal);
            records[currentEditOriginalIndex].completed = completedVal;

            localStorage.setItem('moodRecords', JSON.stringify(records));
            updateStatistics();
            displayRecords();
            closeEditModal();
        });
    }

    if (editCancel) {
        editCancel.addEventListener('click', function() {
            closeEditModal();
        });
    }

    if (editModal) {
        editModal.addEventListener('click', function(e) {
            if (e.target === editModal) closeEditModal();
        });
    }

    // エクスポート/インポート機能
    const exportButton = document.getElementById('export-button');
    const importButton = document.getElementById('import-button');
    const importFile = document.getElementById('import-file');
    const importStatus = document.getElementById('import-status');

    if (exportButton) {
        exportButton.addEventListener('click', function() {
            try {
                const dataStr = JSON.stringify(records, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'moodRecords.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            } catch (e) {
                alert('エクスポートに失敗しました: ' + e.message);
            }
        });
    }

    if (importButton && importFile) {
        importButton.addEventListener('click', function() {
            importFile.value = null;
            importFile.click();
        });

        importFile.addEventListener('change', function(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const parsed = JSON.parse(ev.target.result);
                    if (!Array.isArray(parsed)) {
                        throw new Error('JSONは配列である必要があります');
                    }

                    // 簡易バリデーションと正規化
                    const imported = [];
                    parsed.forEach(function(item) {
                        if (!item || typeof item !== 'object') return;
                        const date = item.date || '';
                        const content = item.content || '';
                        const mood = parseInt(item.mood) || 0;
                        const time = item.time || '';
                        const completed = !!item.completed;
                        if (!date || !content || !mood) return; // 必要項目がないものはスキップ
                        // id がなければ付与
                        const id = item.id || generateId();
                        imported.push({ id, date, time, content, mood, completed });
                    });

                    if (imported.length === 0) {
                        importStatus.textContent = 'インポート可能なレコードが見つかりませんでした';
                        return;
                    }

                    // 既存データに追加（重複チェックは行わない）
                    pushHistory();
                    records = records.concat(imported);
                    localStorage.setItem('moodRecords', JSON.stringify(records));
                    updateStatistics();
                    displayRecords();
                    importStatus.textContent = 'インポート完了: ' + imported.length + '件追加しました';
                } catch (err) {
                    importStatus.textContent = 'インポートエラー: ' + err.message;
                }
            };
            reader.onerror = function() {
                importStatus.textContent = 'ファイルの読み込みに失敗しました';
            };
            reader.readAsText(file, 'utf-8');
        });
    }

    // Undo ボタンイベント
    const undoButton = document.getElementById('undo-button');
    if (undoButton) {
        undoButton.addEventListener('click', function() {
            if (confirm('直前の操作を取り消します。よろしいですか？')) undo();
        });
    }

    // 初期状態で Undo ボタン表示を更新
    updateUndoButtonState();
});
