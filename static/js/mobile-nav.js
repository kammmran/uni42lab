(function () {
    function setupMobileNav() {
        var header = document.querySelector('.header-container');
        var headerRight = document.querySelector('.header-right');
        var nav = document.querySelector('.main-nav');

        if (!header || !headerRight || !nav) {
            return;
        }

        if (document.querySelector('.mobile-menu-toggle')) {
            return;
        }

        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'mobile-menu-toggle';
        toggle.setAttribute('aria-label', 'Open navigation menu');
        toggle.setAttribute('aria-expanded', 'false');

        var svgNs = 'http://www.w3.org/2000/svg';

        var menuIcon = document.createElementNS(svgNs, 'svg');
        menuIcon.setAttribute('viewBox', '0 0 24 24');
        menuIcon.setAttribute('class', 'mobile-menu-icon mobile-menu-icon-menu');
        menuIcon.setAttribute('aria-hidden', 'true');

        var menuLine1 = document.createElementNS(svgNs, 'line');
        menuLine1.setAttribute('x1', '4');
        menuLine1.setAttribute('y1', '7');
        menuLine1.setAttribute('x2', '20');
        menuLine1.setAttribute('y2', '7');

        var menuLine2 = document.createElementNS(svgNs, 'line');
        menuLine2.setAttribute('x1', '4');
        menuLine2.setAttribute('y1', '12');
        menuLine2.setAttribute('x2', '20');
        menuLine2.setAttribute('y2', '12');

        var menuLine3 = document.createElementNS(svgNs, 'line');
        menuLine3.setAttribute('x1', '4');
        menuLine3.setAttribute('y1', '17');
        menuLine3.setAttribute('x2', '20');
        menuLine3.setAttribute('y2', '17');

        menuIcon.appendChild(menuLine1);
        menuIcon.appendChild(menuLine2);
        menuIcon.appendChild(menuLine3);

        var closeIcon = document.createElementNS(svgNs, 'svg');
        closeIcon.setAttribute('viewBox', '0 0 24 24');
        closeIcon.setAttribute('class', 'mobile-menu-icon mobile-menu-icon-close');
        closeIcon.setAttribute('aria-hidden', 'true');

        var closeLine1 = document.createElementNS(svgNs, 'line');
        closeLine1.setAttribute('x1', '6');
        closeLine1.setAttribute('y1', '6');
        closeLine1.setAttribute('x2', '18');
        closeLine1.setAttribute('y2', '18');

        var closeLine2 = document.createElementNS(svgNs, 'line');
        closeLine2.setAttribute('x1', '18');
        closeLine2.setAttribute('y1', '6');
        closeLine2.setAttribute('x2', '6');
        closeLine2.setAttribute('y2', '18');

        closeIcon.appendChild(closeLine1);
        closeIcon.appendChild(closeLine2);

        toggle.appendChild(menuIcon);
        toggle.appendChild(closeIcon);

        var overlay = document.createElement('div');
        overlay.className = 'mobile-nav-overlay';

        function closeNav() {
            document.body.classList.remove('nav-open');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open navigation menu');
        }

        function openNav() {
            document.body.classList.add('nav-open');
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Close navigation menu');
        }

        toggle.addEventListener('click', function () {
            if (document.body.classList.contains('nav-open')) {
                closeNav();
            } else {
                openNav();
            }
        });

        overlay.addEventListener('click', closeNav);

        nav.querySelectorAll('.nav-link').forEach(function (link) {
            link.addEventListener('click', closeNav);
        });

        window.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeNav();
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 768) {
                closeNav();
            }
        });

        headerRight.appendChild(toggle);
        document.body.appendChild(overlay);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMobileNav);
    } else {
        setupMobileNav();
    }
})();
