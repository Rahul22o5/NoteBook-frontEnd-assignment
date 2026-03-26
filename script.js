document.addEventListener('DOMContentLoaded', () => {
    // API Endpoint Configuration
    // IMPORTANT: Replace 'YOUR_ENDPOINT_ID_HERE' with your actual endpoint ID from crudcrud.com 
    // Example: if your url is https://crudcrud.com/api/123456789/notes, then the ID is 123456789
    const API_ENDPOINT_ID = "ddf069aae47449429aef1fc0f2eb82cf";
    const API_URL = `https://crudcrud.com/api/${API_ENDPOINT_ID}/notes`;

    // Elements
    const noteForm = document.getElementById('note-form');
    const noteTitleInput = document.getElementById('note-title');
    const noteDescInput = document.getElementById('note-desc');
    const notesListContainer = document.getElementById('notes-list');
    const totalNotesEl = document.getElementById('total-notes');
    const showingNotesEl = document.getElementById('showing-notes');
    const searchNotesInput = document.getElementById('search-notes');
    const addBtn = document.getElementById('add-btn');

    let notes = [];
    let isEditing = false;
    let editNoteId = null;

    // Load initial notes from CrudCrud
    fetchNotes();

    // Event Listeners
    noteForm.addEventListener('submit', handleFormSubmit);
    searchNotesInput.addEventListener('input', () => {
        renderNotes(searchNotesInput.value.trim());
    });

    async function fetchNotes() {
        try {
            notesListContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading your notes...</p></div>';

            const response = await axios.get(API_URL);
            notes = response.data;
            updateStats();
            renderNotes(searchNotesInput.value.trim());
        } catch (error) {
            console.error("Error fetching notes:", error);
            notesListContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-cloud-bolt"></i><p>Failed to load notes. Please check your CrudCrud endpoint or API limits.</p></div>';
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const title = noteTitleInput.value.trim();
        const desc = noteDescInput.value.trim();

        if (!title || !desc) return;

        // Show loading state on button
        const originalBtnText = addBtn.innerHTML;
        addBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
        addBtn.disabled = true;

        try {
            if (isEditing) {
                // Update existing note via PUT
                // crudcrud demands we omit _id from request body
                const noteData = { title, desc };

                await axios.put(`${API_URL}/${editNoteId}`, noteData);

                // Update local array for immediate UI sync
                const noteIndex = notes.findIndex(note => note._id === editNoteId);
                if (noteIndex !== -1) {
                    notes[noteIndex] = { ...notes[noteIndex], title, desc };
                }

                isEditing = false;
                editNoteId = null;
                addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add To Book';
            } else {
                // Add new note via POST
                const newNoteData = { title, desc };
                const response = await axios.post(API_URL, newNoteData);

                // Add new note from API to local array
                notes.push(response.data);
            }

            updateStats();
            renderNotes(searchNotesInput.value.trim());
            noteForm.reset();
        } catch (error) {
            console.error("Error saving note:", error);
            alert("Failed to save note. Please verify your CRUDCRUD endpoint.");
            addBtn.innerHTML = originalBtnText; // Restore original text ONLY if failed
        } finally {
            if (!isEditing && addBtn.innerHTML.includes('Processing')) {
                addBtn.innerHTML = originalBtnText; // Ensure POST sets it back
            }
            addBtn.disabled = false;
        }
    }

    function renderNotes(filterText = '') {
        notesListContainer.innerHTML = '';

        const filteredNotes = notes.filter(note => {
            const lowerFilterStr = filterText.toLowerCase();
            return note.title.toLowerCase().includes(lowerFilterStr);
        });

        if (filteredNotes.length === 0) {
            notesListContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-folder-open"></i>
                    <p>${filterText ? 'No matching notes found.' : 'No notes yet. Start writing!'}</p>
                </div>
            `;
            showingNotesEl.textContent = '0';
            return;
        }

        filteredNotes.forEach(note => {
            const card = document.createElement('div');
            card.classList.add('note-card');

            // CrudCrud assigns a unique _id string field
            const noteId = note._id;

            card.innerHTML = `
                <h3 class="note-title">${escapeHTML(note.title)}</h3>
                <div class="note-desc">${escapeHTML(note.desc)}</div>
                <div class="note-actions">
                    <button class="action-btn edit" title="Edit Note" data-id="${noteId}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-btn delete" title="Delete Note" data-id="${noteId}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            notesListContainer.appendChild(card);
        });

        // Add event listeners for new node elements
        document.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', () => prepareEdit(btn.getAttribute('data-id')));
        });
        document.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteNote(btn.getAttribute('data-id')));
        });

        showingNotesEl.textContent = filteredNotes.length;
    }

    function updateStats() {
        totalNotesEl.textContent = notes.length;
    }

    async function deleteNote(id) {
        if (confirm('Are you sure you want to delete this note?')) {
            // Apply loading spinner to delete button
            const noteCardButton = document.querySelector(`.delete[data-id="${id}"]`);
            if (noteCardButton) {
                noteCardButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                noteCardButton.disabled = true;
            }

            try {
                // Delete from API
                await axios.delete(`${API_URL}/${id}`);

                // Update local array and re-render
                notes = notes.filter(note => note._id !== id);
                updateStats();

                // If user was editing this exact note, reset form
                if (isEditing && editNoteId === id) {
                    isEditing = false;
                    editNoteId = null;
                    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Add To Book';
                    noteForm.reset();
                }

                renderNotes(searchNotesInput.value.trim());

            } catch (error) {
                console.error("Error deleting note:", error);
                alert("Wait a bit, failed to delete the note. Are you out of requests?");
                // Refetch notes entirely to resolve mismatch
                fetchNotes();
            }
        }
    }

    function prepareEdit(id) {
        const noteToEdit = notes.find(note => note._id === id);
        if (noteToEdit) {
            noteTitleInput.value = noteToEdit.title;
            noteDescInput.value = noteToEdit.desc;
            isEditing = true;
            editNoteId = id;
            addBtn.innerHTML = '<i class="fa-solid fa-check"></i> Update Note';

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        }
    }

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
