function show(id, btn) {
    document.querySelectorAll('.content').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}
