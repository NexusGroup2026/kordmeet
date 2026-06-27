import sys
html = open('C:/xampp/htdocs/index.html', 'r', encoding='utf-8').read()

# Add Forum tab button after curator
old = 'onclick="switchAdminTab(\'curator\')" style="background:rgba(255,255,255,0.04); color:#94a3b8; border:1px solid rgba(255,255,255,0.08); padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:600; font-size:13px; white-space:nowrap;">🤖 Auto-Curator</button>'
new = old + '\n                        <button class="admin-tab-btn" data-tab="forum" onclick="switchAdminTab(\'forum\')" style="background:rgba(255,255,255,0.04); color:#94a3b8; border:1px solid rgba(255,255,255,0.08); padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:600; font-size:13px; white-space:nowrap;">💬 Forum Kord</button>'
if old in html:
    html = html.replace(old, new, 1)
    print('forum btn ok')
else:
    print('curator btn not found')

# Add Rewards tab button before Danger
old2 = 'onclick="switchAdminTab(\'danger\')" style="background:rgba(239,68,68,0.08); color:#ef4444;"'
new2 = 'onclick="switchAdminTab(\'rewards\')" style="background:rgba(255,255,255,0.04); color:#94a3b8; border:1px solid rgba(255,255,255,0.08); padding:8px 16px; border-radius:10px; cursor:pointer; font-weight:600; font-size:13px; white-space:nowrap;">🏅 Ativ. Premiadas</button>\n                        <button class="admin-tab-btn" data-tab="danger" onclick="switchAdminTab(\'danger\')" style="background:rgba(239,68,68,0.08); color:#ef4444;"'
if old2 in html:
    html = html.replace(old2, new2, 1)
    print('rewards btn ok')
else:
    print('danger btn not found')

# Add forum tab content
forum_content = '''
                    <!-- TAB: FORUM KORD -->
                    <div id="admin-tab-forum" class="admin-tab-content" style="display:none;">
                        <div style="display:grid;grid-template-columns:360px 1fr;gap:16px;">
                            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;">
                                <h3 style="color:#f8fafc;margin:0 0 12px 0;">💬 Postar no Forum</h3>
                                <input id="admin-forum-title" placeholder="Título..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;color:#fff;margin-bottom:8px;box-sizing:border-box;">
                                <select id="admin-forum-cat" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;color:#fff;margin-bottom:8px;">
                                    <option value="announcement">📢 Anúncio</option>
                                    <option value="activity">🏅 Atividade Premiada</option>
                                    <option value="update">🚀 Atualização</option>
                                    <option value="security">🛡️ Segurança</option>
                                    <option value="community">👥 Comunidade</option>
                                </select>
                                <textarea id="admin-forum-text" placeholder="Mensagem..." rows="5" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;color:#fff;margin-bottom:12px;resize:vertical;box-sizing:border-box;"></textarea>
                                <button onclick="adminPostForum()" style="width:100%;background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:700;">📤 PUBLICAR</button>
                            </div>
                            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;overflow:auto;">
                                <h3 style="color:#f8fafc;margin:0 0 12px 0;">📋 Posts Recentes</h3>
                                <div id="admin-forum-list" style="display:flex;flex-direction:column;gap:10px;"></div>
                            </div>
                        </div>
                    </div>
'''
marker = '<!-- TAB: ACCESS LOGS -->'
if marker in html:
    html = html.replace(marker, forum_content + marker, 1)
    print('forum content ok')
else:
    print('marker not found')

# Add rewards tab content
rewards_content = '''
                    <!-- TAB: ACTIVITY REWARDS -->
                    <div id="admin-tab-rewards" class="admin-tab-content" style="display:none;">
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;">
                                <h3 style="color:#f8fafc;margin:0 0 12px 0;">🏅 Publicar Recompensa</h3>
                                <input id="admin-reward-user" placeholder="Email do usuário..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;color:#fff;margin-bottom:8px;box-sizing:border-box;">
                                <select id="admin-reward-type" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;color:#fff;margin-bottom:8px;">
                                    <option value="top_contributor">🏆 Top Contribuidor</option>
                                    <option value="active_member">💬 Membro Ativo</option>
                                    <option value="helper">🤝 Ajudante</option>
                                    <option value="early_adopter">🚀 Early Adopter</option>
                                    <option value="bug_hunter">🐛 Caçador de Bugs</option>
                                    <option value="translator">🌍 Tradutor</option>
                                    <option value="special">⭐ Especial</option>
                                </select>
                                <input id="admin-reward-title" placeholder="Título..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;color:#fff;margin-bottom:8px;box-sizing:border-box;">
                                <textarea id="admin-reward-msg" placeholder="Descrição..." rows="3" style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;color:#fff;margin-bottom:12px;resize:vertical;box-sizing:border-box;"></textarea>
                                <button onclick="adminPostReward()" style="width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;padding:12px;border-radius:10px;cursor:pointer;font-weight:700;">🏅 PUBLICAR RECOMPENSA</button>
                            </div>
                            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:20px;overflow:auto;">
                                <h3 style="color:#f8fafc;margin:0 0 12px 0;">🏆 Ranking de Atividade</h3>
                                <div id="admin-rewards-list" style="display:flex;flex-direction:column;gap:8px;"></div>
                            </div>
                        </div>
                    </div>
'''
html = html.replace(marker, rewards_content + marker, 1)
print('rewards content ok')

open('C:/xampp/htdocs/index.html', 'w', encoding='utf-8').write(html)
print('ALL DONE')