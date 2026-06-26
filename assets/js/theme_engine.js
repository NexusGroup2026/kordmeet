function applyCustomTheme(hexColor) {
    if (!hexColor || !hexColor.startsWith('#')) return;

    // Apply the full string to the primary variable
    document.documentElement.style.setProperty('--primary-color', hexColor);

    // Derived colors for a "Total Design" feel
    const rgb = hexToRgbValues(hexColor);
    if (rgb) {
        // Subtle background based on the theme
        document.documentElement.style.setProperty('--kord-bg-tint', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05)`);
        document.documentElement.style.setProperty('--kord-sidebar-tint', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
        document.documentElement.style.setProperty('--primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);

        // Dark version for backgrounds (very subtle)
        const darkBg = `rgba(${Math.floor(rgb.r * 0.1)}, ${Math.floor(rgb.g * 0.1)}, ${Math.floor(rgb.b * 0.1)}, 1)`;
        document.documentElement.style.setProperty('--surface-base', darkBg);
    }
}

// Dynamically applies AI-generated custom CSS (glitches, matrix fx, etc)
function applyCustomCSS(cssString) {
    let styleTag = document.getElementById('kord-ai-custom-css');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'kord-ai-custom-css';
        document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = cssString || '';
}

function hexToRgbValues(hex) {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.substring(0, 7));
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function saveThemeColor(hexColor) {
    if (!currentUser) return showKordAlert("Erro", "Logue para salvar seu tema!", "error", "#ef4444");

    if (!/^#([0-9A-Fa-f]+)$/i.test(hexColor)) {
        return showKordAlert("Formato Incorreto", "A cor fornecida não é válida.", "format_color_reset", "#f59e0b");
    }

    firebase.database().ref(`users/${currentUser.uid}/profile`).update({
        themeColor: hexColor
    }).then(() => {
        applyCustomTheme(hexColor);
        showKordAlert("Design Atualizado!", "O novo tema foi aplicado em todo o sistema.", "palette", hexColor.substring(0, 7));
    });
}
