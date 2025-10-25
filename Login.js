document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const btnLoginTab = document.getElementById('btnLoginTab');
    const btnRegisterTab = document.getElementById('btnRegisterTab');
    const forgotPasswordLink = document.getElementById('forgotPassword');

    let users = JSON.parse(localStorage.getItem('users')) || [];

    if (users.length === 0) {
        const adminUser = { id: 1, fullName: 'Administrador Principal', email: 'admin@correo.com', password: 'admin', role: 'Administrador' };
        users.push(adminUser);
        localStorage.setItem('users', JSON.stringify(users));
    }

    btnLoginTab.addEventListener('click', () => {
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        btnLoginTab.classList.add('active');
        btnRegisterTab.classList.remove('active');
    });

    btnRegisterTab.addEventListener('click', () => {
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        btnRegisterTab.classList.add('active');
        btnLoginTab.classList.remove('active');
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('emailLogin').value;
        const password = document.getElementById('passwordLogin').value;
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            alert(`¡Bienvenido, ${user.fullName}!`);
            sessionStorage.setItem('loggedInUser', JSON.stringify(user));
            window.location.href = 'dashboard.html';
        } else {
            alert('Correo electrónico o contraseña incorrectos.');
        }
    });

    registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('emailRegister').value;
        const password = document.getElementById('passwordRegister').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) { return alert('Las contraseñas no coinciden.'); }
        if (users.find(u => u.email === email)) { return alert('Este correo electrónico ya está registrado.'); }

        const newUser = { id: Date.now(), fullName, email, password, role: 'Personal' };
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
        registerForm.reset();
        btnLoginTab.click();
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('emailLogin');
        const email = emailInput.value;
        if (!email) {
            alert('Por favor, escribe tu correo electrónico en el campo de arriba y luego haz clic aquí.');
            emailInput.focus();
        } else {
            alert(`Si el correo "${email}" está registrado, se ha enviado un enlace para restablecer la contraseña.`);
        }
    });
});

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}