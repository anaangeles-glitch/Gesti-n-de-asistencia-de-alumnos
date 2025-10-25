document.addEventListener('DOMContentLoaded', () => {
    // --- 1. INICIALIZACIÓN Y SEGURIDAD ---
    let loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
    if (!loggedInUser) {
        window.location.href = 'Login.html'; // Asegura redirección si no hay sesión
        return;
    }

    // --- MANEJO DE ESTADO ROBUSTO ---
    const loadInitialData = (key, defaultValue) => {
        try {
            const storedData = localStorage.getItem(key);
            if (key === 'users' && storedData) {
                let users = JSON.parse(storedData);
                users.forEach(user => {
                    if (user.role === 'Maestro' && !user.assignedGroups) user.assignedGroups = [];
                });
                return users;
            }
            return storedData ? JSON.parse(storedData) : defaultValue;
        } catch (error) { console.error(`Error cargando "${key}"`, error); return defaultValue; }
    };

    let state = {
        users: loadInitialData('users', []),
        groups: loadInitialData('groups', []),
        students: loadInitialData('students', []),
        attendance: loadInitialData('attendance', []),
        activityLog: loadInitialData('activityLog', []),
        lastStudentId: 0
    };
    state.lastStudentId = state.students.reduce((maxId, student) => Math.max(student.id || 0, maxId), 0);
    const saveState = () => { for (const key in state) localStorage.setItem(key, JSON.stringify(state[key])); };
    saveState();

    // --- LOG Y PERMISOS ---
    const logActivity = (description) => {
        if (loggedInUser.role !== 'Administrador') return;
        const newLogEntry = { description, timestamp: new Date().toISOString() };
        state.activityLog.unshift(newLogEntry);
        state.activityLog = state.activityLog.slice(0, 10);
        saveState();
        if(document.getElementById('view-home').classList.contains('active')) renderActivityLog();
    };
    const setupUIByRole = () => {
        const { role } = loggedInUser;
        const isAdmin = role === 'Administrador', isMaestro = role === 'Maestro', isPersonal = role === 'Personal';
        document.getElementById('menu-usuarios').classList.toggle('hidden', !isAdmin);
        document.getElementById('menu-asistencia').classList.toggle('hidden', isPersonal);
        document.getElementById('btn-add-grupo').classList.toggle('hidden', !isAdmin);
        document.getElementById('btn-edit-grupo').classList.toggle('hidden', !isAdmin);
        document.getElementById('btn-delete-grupo').classList.toggle('hidden', !isAdmin);
        document.getElementById('btn-add-alumno').classList.toggle('hidden', isMaestro);
        document.getElementById('th-acciones-alumnos').classList.toggle('hidden', isMaestro);
        document.getElementById('admin-actions').classList.toggle('hidden', !isAdmin);
        document.getElementById('th-grupos-usuarios').classList.toggle('hidden', !isAdmin);
        document.getElementById('th-acciones-usuarios').classList.toggle('hidden', !isAdmin);
        document.getElementById('activity-log-container').classList.toggle('hidden', !isAdmin);
        document.getElementById('maestro-stats-filter').classList.toggle('hidden', !isMaestro);
    };

    // --- NAVEGACIÓN ---
    const views = document.querySelectorAll('.view');
    const menuLinks = document.querySelectorAll('.menu-options a');
    const switchView = (viewName) => {
        if (!viewName) return;
        const targetViewId = `view-${viewName}`;
        views.forEach(view => view.classList.remove('active'));
        document.getElementById(targetViewId).classList.add('active');
        loadViewData(targetViewId);
    };
    menuLinks.forEach(link => {
        if (link.id !== 'btnLogout') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelector('.menu-options li.active').classList.remove('active');
                link.parentElement.classList.add('active');
                switchView(link.dataset.view);
            });
        }
    });

    // --- LÓGICA DE CERRAR SESIÓN (CORREGIDA) ---
    document.getElementById('btnLogout').addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('loggedInUser');
        window.location.href = 'Login.html'; // Redirección a la página de login
    });

    const loadViewData = (viewId) => {
        switch(viewId) {
            case 'view-home': initializeHomeView(); break;
            case 'view-alumnos': initializeAlumnosView(); break;
            case 'view-asistencia': initializeAsistenciaView(); break;
            case 'view-usuarios': initializeUsuariosView(); break;
            case 'view-perfil': initializePerfilView(); break;
        }
    };
    document.getElementById('btn-hard-reset').addEventListener('click', () => {
        if (confirm("¡ADVERTENCIA!\nEsta acción borrará TODOS los datos y empezar de cero.\n\n¿Continuar?")) {
            localStorage.clear(); sessionStorage.clear();
            alert("Todos los datos han sido eliminados.");
            window.location.href = 'Login.html';
        }
    });

    // --- VISTA: INICIO ---
    const getLocalDateString = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const renderActivityLog = () => {
        const logList = document.getElementById('activity-log-list');
        logList.innerHTML = '';
        if (state.activityLog.length === 0) logList.innerHTML = '<li>No hay actividad reciente.</li>';
        else state.activityLog.forEach(entry => logList.innerHTML += `<li>${entry.description}</li>`);
    };
    const updateDashboardStats = (groupId = null) => {
        const hoy = getLocalDateString();
        let studentsInScope = loggedInUser.role === 'Maestro' ? state.students.filter(s => s.groupId == groupId) : state.students;
        if(loggedInUser.role === 'Maestro' && !groupId) studentsInScope = [];
        const totalAlumnos = studentsInScope.length;
        const studentIdsInScope = studentsInScope.map(s => s.id);
        const asistenciasHoy = state.attendance.filter(a => a.date === hoy && studentIdsInScope.includes(a.studentId));
        const retardos = asistenciasHoy.filter(a => a.status === 'retardo').length;
        const presentes = asistenciasHoy.filter(a => a.status === 'asistio' || a.status === 'retardo').length;
        const porcentaje = totalAlumnos > 0 ? (presentes / totalAlumnos) * 100 : 0;
        document.getElementById('total-alumnos').textContent = totalAlumnos;
        document.getElementById('total-retardos').textContent = retardos;
        document.getElementById('porcentaje-asistencia').textContent = `${porcentaje.toFixed(0)}%`;
    };
    const initializeHomeView = () => {
        const grupoSelectStats = document.getElementById('grupo-select-stats');
        if (loggedInUser.role === 'Maestro') {
            const assignedGroupIds = loggedInUser.assignedGroups || [];
            renderGroupSelect(grupoSelectStats, false, assignedGroupIds);
            const defaultGroupId = assignedGroupIds.length > 0 ? assignedGroupIds[0] : null;
            grupoSelectStats.value = defaultGroupId;
            updateDashboardStats(defaultGroupId);
            if (!grupoSelectStats.dataset.listenerAttached) {
                grupoSelectStats.addEventListener('change', () => updateDashboardStats(grupoSelectStats.value));
                grupoSelectStats.dataset.listenerAttached = 'true';
            }
        } else {
            updateDashboardStats();
        }
        if (loggedInUser.role === 'Administrador') renderActivityLog();
    };

    // --- VISTA: ALUMNOS ---
    const modal = document.getElementById('modal-alumno');
    const formAlumno = document.getElementById('form-alumno');
    const grupoSelectAlumnos = document.getElementById('grupo-select-alumnos');
    const initializeAlumnosView = () => {
        const assignedGroupIds = loggedInUser.role === 'Maestro' ? (loggedInUser.assignedGroups || []) : null;
        renderGroupSelect(grupoSelectAlumnos, false, assignedGroupIds);
        const defaultGroupId = assignedGroupIds ? (assignedGroupIds.length > 0 ? assignedGroupIds[0] : null) : grupoSelectAlumnos.value;
        if (defaultGroupId) {
            grupoSelectAlumnos.value = defaultGroupId;
            renderAlumnosTable(defaultGroupId);
        } else {
            document.getElementById('alumnos-tbody').innerHTML = '<tr><td colspan="5">No hay salones asignados o disponibles.</td></tr>';
        }
    };
    const renderGroupSelect = (selectElement, includeAll = false, groupIds = null) => {
        const currentVal = selectElement.value;
        selectElement.innerHTML = '';
        if (includeAll) selectElement.innerHTML += `<option value="todos">Todos</option>`;
        let groupsToRender = groupIds ? state.groups.filter(g => groupIds.includes(g.id)) : state.groups;
        groupsToRender.forEach(group => selectElement.innerHTML += `<option value="${group.id}">${group.name}</option>`);
        selectElement.value = currentVal;
    };
    const renderAlumnosTable = (groupId) => {
        const tbody = document.getElementById('alumnos-tbody');
        tbody.innerHTML = '';
        
        // Modificación para ordenar por Matrícula/Núm. Lista (orden de inscripción)
        const filteredStudents = state.students.filter(s => s.groupId == groupId).sort((a, b) => {
            // Por defecto, se ordena por Matrícula / Núm. Lista.
            // Convertimos a números enteros para un orden de lista correcto
            const matA = parseInt(a.matricula);
            const matB = parseInt(b.matricula);
            
            if (!isNaN(matA) && !isNaN(matB)) {
                return matA - matB; // Orden numérico
            }
            // Si las matrículas no son puramente numéricas, se ordena por cadena (string)
            return a.matricula.localeCompare(b.matricula);

            // Si el usuario decidiera ordenar por Apellidos, se podría cambiar el 'return' a:
            // return a.apellidoPaterno.localeCompare(b.apellidoPaterno);
        }); 

        if (filteredStudents.length === 0) { tbody.innerHTML = '<tr><td colspan="5">No hay alumnos en este salón.</td></tr>'; return; }
        filteredStudents.forEach(student => {
            const actionsCell = loggedInUser.role !== 'Maestro' ? `<td class="action-buttons"><button class="btn-edit" data-id="${student.id}">Editar</button><button class="btn-delete" data-id="${student.id}">Eliminar</button></td>` : '<td>Sin acciones</td>';
            tbody.innerHTML += `<tr><td>${student.matricula}</td><td>${student.nombre}</td><td>${student.apellidoPaterno}</td><td>${student.apellidoMaterno}</td>${actionsCell}</tr>`;
        });
    };
    grupoSelectAlumnos.addEventListener('change', () => renderAlumnosTable(grupoSelectAlumnos.value));
    document.getElementById('btn-add-grupo').addEventListener('click', () => {
        if (state.groups.length === 0) return alert('Primero agrega un salón.');
        const groupName = prompt('Nombre del nuevo salón:');
        if (groupName && groupName.trim() !== '') {
            const trimmedName = groupName.trim();
            state.groups.push({ id: Date.now(), name: trimmedName });
            logActivity(`[+] Creó salón "${trimmedName}".`);
            saveState();
            initializeAlumnosView();
        }
    });
    document.getElementById('btn-edit-grupo').addEventListener('click', () => {
        if (state.groups.length === 0) return;
        const groupIdToEdit = grupoSelectAlumnos.value;
        const groupToEdit = state.groups.find(g => g.id == groupIdToEdit);
        const newGroupName = prompt(`Editando: "${groupToEdit.name}"`, groupToEdit.name);
        if (newGroupName && newGroupName.trim() !== '' && newGroupName.trim() !== groupToEdit.name) {
            const trimmedName = newGroupName.trim();
            logActivity(`[~] Salón "${groupToEdit.name}" a "${trimmedName}".`);
            groupToEdit.name = trimmedName;
            saveState();
            initializeAlumnosView();
        }
    });
    document.getElementById('btn-delete-grupo').addEventListener('click', () => {
        if (state.groups.length === 0) return;
        const groupIdToDelete = grupoSelectAlumnos.value;
        const groupName = state.groups.find(g => g.id == groupIdToDelete)?.name;
        if (confirm(`¿Eliminar salón "${groupName}" y sus alumnos?`)) {
            logActivity(`[-] Eliminó salón "${groupName}".`);
            state.groups = state.groups.filter(g => g.id != groupIdToDelete);
            state.students = state.students.filter(s => s.groupId != groupIdToDelete);
            saveState();
            initializeAlumnosView();
        }
    });
    
    // LÓGICA DE AUTO-GENERACIÓN DE MATRÍCULA ÚNICA POR GRUPO
    document.getElementById('btn-add-alumno').addEventListener('click', () => {
        if (state.groups.length === 0) return alert('Primero agrega un salón.');
        formAlumno.reset();
        document.getElementById('alumno-id').value = '';

        // Lógica: Asignar la siguiente matrícula única en el salón (orden de inscripción/número de lista)
        const groupId = grupoSelectAlumnos.value;
        const studentsInGroup = state.students.filter(s => s.groupId == groupId);
        
        // Busca la matrícula numérica máxima actual en el grupo
        const maxMatricula = studentsInGroup.reduce((max, student) => {
            const currentMatricula = parseInt(student.matricula);
            // Asegura que solo se consideren matrículas numéricas válidas
            return isNaN(currentMatricula) ? max : Math.max(max, currentMatricula);
        }, 0);
        
        // Asigna la siguiente matrícula (máximo + 1), manteniendo el campo editable.
        const nextMatricula = maxMatricula + 1;
        document.getElementById('alumno-matricula').value = nextMatricula;

        modal.classList.remove('hidden');
    });
    // FIN DE LA LÓGICA DE AUTO-GENERACIÓN DE MATRÍCULA
    
    modal.addEventListener('click', (e) => { if (e.target.matches('.modal-overlay, .btn-cancel-modal')) modal.classList.add('hidden'); });
    formAlumno.addEventListener('submit', (e) => {
        e.preventDefault();
        const studentId = document.getElementById('alumno-id').value;
        const matricula = document.getElementById('alumno-matricula').value.trim();
        const groupId = grupoSelectAlumnos.value;
        if (!matricula) { alert("La matrícula es obligatoria."); return; }
        
        // Validación de matrícula única por grupo:
        const isMatriculaDuplicate = state.students.some(s => s.groupId == groupId && s.matricula === matricula && s.id != studentId);
        if (isMatriculaDuplicate) {
            alert(`Error: La matrícula "${matricula}" ya existe en este salón.`);
            return;
        }
        
        const studentData = { matricula, nombre: document.getElementById('alumno-nombre').value, apellidoPaterno: document.getElementById('alumno-paterno').value, apellidoMaterno: document.getElementById('alumno-materno').value, groupId };
        const fullName = `${studentData.nombre} ${studentData.apellidoPaterno}`;
        if (studentId) {
            const index = state.students.findIndex(s => s.id == studentId);
            state.students[index] = { ...state.students[index], ...studentData };
            logActivity(`[~] Actualizó a ${fullName}.`);
        } else {
            state.lastStudentId++;
            const newStudent = { id: state.lastStudentId, ...studentData };
            state.students.push(newStudent);
            logActivity(`[+] Agregó a ${fullName}.`);
        }
        saveState();
        renderAlumnosTable(groupId);
        modal.classList.add('hidden');
    });
    document.getElementById('alumnos-tbody').addEventListener('click', (e) => {
        const studentId = e.target.dataset.id;
        if (e.target.classList.contains('btn-edit')) {
            const student = state.students.find(s => s.id == studentId);
            document.getElementById('alumno-id').value = student.id;
            document.getElementById('alumno-matricula').value = student.matricula;
            document.getElementById('alumno-nombre').value = student.nombre;
            document.getElementById('alumno-paterno').value = student.apellidoPaterno;
            document.getElementById('alumno-materno').value = student.apellidoMaterno;
            modal.classList.remove('hidden');
        }
        if (e.target.classList.contains('btn-delete')) {
            const student = state.students.find(s => s.id == studentId);
            if (confirm(`¿Eliminar a ${student.nombre}?`)) {
                state.students = state.students.filter(s => s.id != studentId);
                logActivity(`[-] Eliminó al alumno ${student.nombre}.`);
                saveState();
                renderAlumnosTable(grupoSelectAlumnos.value);
            }
        }
    });

    // --- VISTA: ASISTENCIA ---
    const grupoSelectAsistencia = document.getElementById('grupo-select-asistencia');
    const fechaAsistencia = document.getElementById('fecha-asistencia');
    const initializeAsistenciaView = () => {
        const assignedGroupIds = loggedInUser.role === 'Maestro' ? (loggedInUser.assignedGroups || []) : null;
        renderGroupSelect(grupoSelectAsistencia, false, assignedGroupIds);
        fechaAsistencia.value = getLocalDateString();
        const defaultGroupId = assignedGroupIds ? (assignedGroupIds.length > 0 ? assignedGroupIds[0] : null) : grupoSelectAsistencia.value;
        if (defaultGroupId) {
            grupoSelectAsistencia.value = defaultGroupId;
            renderAsistenciaTable();
        } else {
            document.getElementById('asistencia-tbody').innerHTML = '<tr><td colspan="4">No hay salones asignados o disponibles.</td></tr>';
        }
    };
    const renderAsistenciaTable = () => {
        const groupId = grupoSelectAsistencia.value;
        const date = fechaAsistencia.value;
        const tbody = document.getElementById('asistencia-tbody');
        tbody.innerHTML = '';
        const studentsInGroup = state.students.filter(s => s.groupId == groupId).sort((a, b) => {
            // Se usa la misma lógica de ordenamiento por matrícula
            const matA = parseInt(a.matricula);
            const matB = parseInt(b.matricula);
            
            if (!isNaN(matA) && !isNaN(matB)) {
                return matA - matB;
            }
            return a.matricula.localeCompare(b.matricula);
        }); 
        if (studentsInGroup.length === 0) { tbody.innerHTML = '<tr><td colspan="4">No hay alumnos en este salón.</td></tr>'; return; }
        studentsInGroup.forEach(student => {
            let record = state.attendance.find(a => a.studentId === student.id && a.date === date);
            if (!record) {
                record = { studentId: student.id, date, status: 'falta', observations: '' };
                state.attendance.push(record);
            }
            const isAdminView = loggedInUser.role === 'Administrador' ? 'disabled' : '';
            tbody.innerHTML += `<tr data-studentid="${student.id}"><td>${student.matricula}</td><td>${student.nombre} ${student.apellidoPaterno} ${student.apellidoMaterno}</td><td class="status-buttons"><button class="attendance-btn asistio ${record.status === 'asistio' ? 'selected' : ''}" data-status="asistio" ${isAdminView}>Asistió</button><button class="attendance-btn falta ${record.status === 'falta' ? 'selected' : ''}" data-status="falta" ${isAdminView}>Faltó</button><button class="attendance-btn retardo ${record.status === 'retardo' ? 'selected' : ''}" data-status="retardo" ${isAdminView}>Retardo</button></td><td><input type="text" class="obs-input" placeholder="Observaciones..." value="${record.observations}" ${isAdminView}></td></tr>`;
        });
        saveState();
    };
    grupoSelectAsistencia.addEventListener('change', renderAsistenciaTable);
    fechaAsistencia.addEventListener('change', renderAsistenciaTable);
    const saveAttendance = (row) => {
        const studentId = parseInt(row.dataset.studentid);
        const date = fechaAsistencia.value;
        const recordIndex = state.attendance.findIndex(a => a.studentId === studentId && a.date === date);
        if (recordIndex === -1) return;
        const selectedBtn = row.querySelector('.attendance-btn.selected');
        state.attendance[recordIndex].status = selectedBtn ? selectedBtn.dataset.status : 'falta';
        state.attendance[recordIndex].observations = row.querySelector('.obs-input').value;
        saveState();
        initializeHomeView();
    };
    document.getElementById('asistencia-tbody').addEventListener('click', (e) => {
        if (e.target.classList.contains('attendance-btn')) {
            const row = e.target.closest('tr');
            row.querySelectorAll('.attendance-btn').forEach(btn => btn.classList.remove('selected'));
            e.target.classList.add('selected');
            saveAttendance(row);
        }
    });
    document.getElementById('asistencia-tbody').addEventListener('input', (e) => { if(e.target.classList.contains('obs-input')) saveAttendance(e.target.closest('tr')); });
    
    // --- LÓGICA DE DESCARGA DE ASISTENCIA (IMPLEMENTADA) ---
    document.getElementById('btn-download-asistencia').addEventListener('click', () => {
        const groupId = grupoSelectAsistencia.value;
        const date = fechaAsistencia.value;
        const groupName = state.groups.find(g => g.id == groupId)?.name || 'Grupo Desconocido';

        if (!groupId || !date) {
            alert('Por favor, seleccione un salón y una fecha.');
            return;
        }

        const studentsInGroup = state.students.filter(s => s.groupId == groupId);
        
        if (studentsInGroup.length === 0) {
            alert('No hay alumnos para descargar en este salón.');
            return;
        }

        // 1. Prepare CSV Header
        let csv = 'Matrícula,Nombre Completo,Estatus,Observaciones\n';

        // 2. Iterate students, find attendance, and build CSV rows
        studentsInGroup.sort((a, b) => {
            const matA = parseInt(a.matricula);
            const matB = parseInt(b.matricula);
            return (!isNaN(matA) && !isNaN(matB)) ? matA - matB : a.matricula.localeCompare(b.matricula);
        }) 
            .forEach(student => {
                const record = state.attendance.find(a => a.studentId === student.id && a.date === date);
                
                // Función auxiliar para escapar comillas dobles y asegurarse de que el CSV funcione
                const escapeCsv = (text) => `"${String(text).replace(/"/g, '""')}"`;

                const matricula = escapeCsv(student.matricula);
                const fullName = escapeCsv(`${student.nombre} ${student.apellidoPaterno} ${student.apellidoMaterno}`);
                const status = escapeCsv(record ? record.status.toUpperCase() : 'FALTA');
                const observations = escapeCsv(record && record.observations ? record.observations : '');

                csv += `${matricula},${fullName},${status},${observations}\n`;
            });

        // 3. Create Blob and trigger download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) { 
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Asistencia_${groupName.replace(/\s/g, '_')}_${date}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            logActivity(`[~] Descargó asistencia para salón "${groupName}" del ${date}.`);
        } else {
            alert('Tu navegador no soporta la descarga automática. Por favor, copia el contenido de la tabla manualmente.');
        }
    });
    // --- FIN DE LÓGICA DE DESCARGA ---

    // --- VISTA: USUARIOS ---
    const initializeUsuariosView = () => {
        const tbody = document.getElementById('usuarios-tbody');
        tbody.innerHTML = '';
        state.users.forEach(user => {
            const isSelf = user.id === loggedInUser.id, isAdmin = loggedInUser.role === 'Administrador';
            const rolSelect = isSelf || !isAdmin || user.role === 'Administrador' ? user.role : `<select data-userid="${user.id}" class="user-role-select"><option value="Personal" ${user.role === 'Personal' ? 'selected' : ''}>Personal</option><option value="Maestro" ${user.role === 'Maestro' ? 'selected' : ''}>Maestro</option></select>`;
            const assignBtn = isAdmin && user.role === 'Maestro' ? `<button class="btn-primary btn-assign-groups" data-userid="${user.id}">Asignar</button>` : 'N/A';
            const deleteButton = isAdmin && !isSelf && user.role !== 'Administrador' ? `<button class="btn-delete btn-delete-user" data-userid="${user.id}">Eliminar</button>` : '';
            tbody.innerHTML += `<tr><td>${user.fullName}</td><td>${user.email}</td><td>${rolSelect}</td><td>${assignBtn}</td><td class="action-buttons">${deleteButton}</td></tr>`;
        });
    };
    document.getElementById('usuarios-tbody').addEventListener('change', (e) => {
        if (e.target.classList.contains('user-role-select')) {
            const userId = parseInt(e.target.dataset.userid), newRole = e.target.value;
            const userIndex = state.users.findIndex(u => u.id === userId);
            if (userIndex !== -1) {
                logActivity(`[~] Rol de ${state.users[userIndex].fullName} a ${newRole}.`);
                state.users[userIndex].role = newRole;
                if (newRole !== 'Maestro') state.users[userIndex].assignedGroups = [];
                saveState();
                initializeUsuariosView();
            }
        }
    });
    document.getElementById('usuarios-tbody').addEventListener('click', (e) => {
        const userId = e.target.dataset.userid;
        if (e.target.classList.contains('btn-delete-user')) {
            const userToDelete = state.users.find(u => u.id == userId);
            if (userToDelete && confirm(`¿Eliminar a ${userToDelete.fullName}?`)) {
                state.users = state.users.filter(u => u.id != userId);
                logActivity(`[-] Eliminó al usuario ${userToDelete.fullName}.`);
                saveState();
                initializeUsuariosView();
            }
        }
        if (e.target.classList.contains('btn-assign-groups')) openAssignGroupsModal(userId);
    });
    const modalAssign = document.getElementById('modal-assign-groups');
    const formAssign = document.getElementById('form-assign-groups');
    let currentUserIdToAssign = null;
    const openAssignGroupsModal = (userId) => {
        currentUserIdToAssign = userId;
        const user = state.users.find(u => u.id == userId);
        document.getElementById('modal-assign-title').textContent = `Asignar Grupos a: ${user.fullName}`;
        const container = document.getElementById('groups-checkbox-container');
        container.innerHTML = '';
        state.groups.forEach(group => {
            const isChecked = user.assignedGroups && user.assignedGroups.includes(group.id) ? 'checked' : '';
            container.innerHTML += `<div><input type="checkbox" id="group-${group.id}" value="${group.id}" ${isChecked}><label for="group-${group.id}">${group.name}</label></div>`;
        });
        modalAssign.classList.remove('hidden');
    };
    formAssign.addEventListener('submit', (e) => {
        e.preventDefault();
        const userIndex = state.users.findIndex(u => u.id == currentUserIdToAssign);
        const assignedGroups = [];
        formAssign.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => assignedGroups.push(parseInt(checkbox.value)));
        state.users[userIndex].assignedGroups = assignedGroups;
        logActivity(`[~] Actualizó grupos de ${state.users[userIndex].fullName}.`);
        saveState();
        modalAssign.classList.add('hidden');
    });
    modalAssign.addEventListener('click', (e) => { if (e.target.matches('.modal-overlay, .btn-cancel-modal')) modalAssign.classList.add('hidden'); });

    // --- VISTA: PERFIL ---
    const initializePerfilView = () => {
        loggedInUser = JSON.parse(sessionStorage.getItem('loggedInUser'));
        document.getElementById('profile-name').value = loggedInUser.fullName;
        document.getElementById('profile-email').value = loggedInUser.email;
        document.getElementById('form-change-password').reset();
    };
    document.getElementById('form-update-profile').addEventListener('submit', (e) => {
        e.preventDefault();
        const newFullName = document.getElementById('profile-name').value.trim();
        if (!newFullName) { alert("El nombre no puede estar vacío."); return; }
        loggedInUser.fullName = newFullName;
        sessionStorage.setItem('loggedInUser', JSON.stringify(loggedInUser));
        const userIndex = state.users.findIndex(user => user.id === loggedInUser.id);
        if (userIndex !== -1) state.users[userIndex].fullName = newFullName;
        saveState();
        document.getElementById('userName').textContent = newFullName;
        alert('Nombre actualizado.');
    });
    document.getElementById('recover-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        if(confirm("Se enviará un correo para restablecer contraseña?")) alert(`Enlace de recuperación enviado a: ${loggedInUser.email}`);
    });
    
    // --- CARGA INICIAL ---
    document.getElementById('userName').textContent = loggedInUser.fullName;
    document.getElementById('userRole').textContent = loggedInUser.role;
    setupUIByRole();
    switchView('home');
});