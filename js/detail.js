// 詳細ページ用スクリプト
document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const area = document.getElementById('detail-area');
    if (!id || !area) {
        area.innerHTML = '<p>不正なIDです。</p>';
        return;
    }

    const saved = localStorage.getItem('moodRecords');
    if (!saved) {
        area.innerHTML = '<p>データが見つかりません。</p>';
        return;
    }
    try {
        const records = JSON.parse(saved);
        const record = records.find(r => r.id === id);
        if (!record) {
            area.innerHTML = '<p>指定した記録が見つかりませんでした。</p>';
            return;
        }

        const dateObj = new Date(record.date + 'T00:00:00');
        const formattedDate = dateObj.getFullYear() + '年' + (dateObj.getMonth()+1) + '月' + dateObj.getDate() + '日';

        const moodStars = '★'.repeat(record.mood || 0);

        area.innerHTML = `
            <h2>${formattedDate} ${record.time || ''}</h2>
            <p class="record-content">${escapeHtml(record.content)}</p>
            <p class="record-mood">気分: ${moodStars} (${record.mood}/5)</p>
            <p>完了: ${record.completed ? 'はい' : 'いいえ'}</p>
            <div style="margin-top:12px;">
                <button id="delete-detail" class="delete-button">この記録を削除</button>
                <a id="edit-detail" class="detail-button" href="#">編集（一覧で）</a>
            </div>
        `;

        document.getElementById('delete-detail').addEventListener('click', function() {
            if (!confirm('この記録を削除してもよろしいですか？')) return;
            const newRecords = records.filter(r => r.id !== id);
            localStorage.setItem('moodRecords', JSON.stringify(newRecords));
            // 詳細削除後は一覧へ戻る
            window.location.href = 'index.html';
        });

        // 編集リンク: index.html へ editId パラメータ付きで遷移
        document.getElementById('edit-detail').setAttribute('href', 'index.html?editId=' + encodeURIComponent(id));

    } catch (e) {
        area.innerHTML = '<p>データの読み込みに失敗しました。</p>';
        console.error(e);
    }
});
// HTMLエスケープ関数
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
