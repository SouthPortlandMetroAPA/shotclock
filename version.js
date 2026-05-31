/* ════════════════════════════════════════════════════════════════════════
   ShotClock — single global version constant.

   Workflow on every deploy:
     1. Edit window.APP_VERSION here.
     2. (optional, when registered in apa_core.apps)
        UPDATE apa_core.apps SET version=$NEW WHERE app_name='ShotClock'.
     3. git push.
   ════════════════════════════════════════════════════════════════════════ */
window.APP_VERSION = '0.1';
