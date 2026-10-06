const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('mobile defaults to the web-aligned light design system', () => {
  const app = JSON.parse(read('app.json'));
  const theme = read('src/context/ThemeContext.js');
  assert.equal(app.expo.userInterfaceStyle, 'light');
  assert.match(theme, /const \[isDark, setIsDark\] = useState\(false\)/);
  assert.match(theme, /primary: '#6366f1'/);
  assert.match(theme, /background: '#f8fafc'/);
});

test('API configuration uses the production backend and keeps tokens secure', () => {
  const api = read('src/config/api.js');
  assert.doesNotMatch(api, /192\.168\./);
  assert.match(api, /https:\/\/api-crm\.advaitdigital\.co\.in\/api/);
  assert.doesNotMatch(api, /crm_server_url|setServerUrl|testServerConnection/);
  assert.match(api, /SecureStore/);
  assert.match(api, /unauthorizedHandler\?\.\(\)/);
});

test('critical mobile workflows use canonical backend routes', () => {
  assert.match(read('src/screens/profile/ProfileScreen.js'), /apiPut\('\/auth\/password'/);
  assert.match(read('src/screens/tasks/TasksScreen.js'), /\/tasks\/\$\{task\.id\}\/status/);
  assert.match(read('src/screens/inventory/InventoryScreen.js'), /\/inventory\/\$\{editingId\}\/adjust/);
  assert.match(read('src/screens/calendar/CalendarScreen.js'), /apiGet\('\/calendar\/events'\)/);
  assert.match(read('src/screens/customers/CustomerDetailScreen.js'), /\/customers\/\$\{customerId\}\/overview/);
  assert.match(read('src/screens/quotations/QuotationsScreen.js'), /items: JSON\.stringify/);
});

test('role permissions and authenticated chat media are enforced', () => {
  const permissions = read('src/config/permissions.js');
  const server = read('../server/routes/api.js');
  assert.match(permissions, /Accounts: FINANCE/);
  assert.match(permissions, /users: ADMIN/);
  assert.match(server, /router\.get\('\/chat\/media\/:filename', authMiddleware/);
  assert.doesNotMatch(server, /Fallback if file was a simulated attachment/);
});

test('field installers can open assigned-work modules without customer or stock screens', () => {
  const source = read('src/config/permissions.js').replaceAll('export const ', 'const ');
  const context = { module: { exports: {} } };
  vm.runInNewContext(`${source}\nmodule.exports = { canAccessScreen, isFieldInstaller };`, context);
  const { canAccessScreen, isFieldInstaller } = context.module.exports;
  for (const role of ['gps_installer', 'cctv_technician']) {
    assert.equal(isFieldInstaller(role), true);
    for (const screen of ['Dashboard', 'Tasks', 'Chat', 'Installations']) {
      assert.equal(canAccessScreen(role, screen), true, `${role} needs ${screen}`);
    }
    for (const screen of ['Customers', 'Inventory', 'Tickets', 'Calendar', 'GlobalSearch']) {
      assert.equal(canAccessScreen(role, screen), false, `${role} must not open ${screen}`);
    }
  }
  assert.equal(canAccessScreen('super_admin', 'Customers'), true);
  assert.equal(canAccessScreen('installation_manager', 'Inventory'), true);
  assert.doesNotMatch(read('src/screens/auth/LoginScreen.js'), /Server Settings|Test & Save/);
  assert.doesNotMatch(read('src/screens/profile/ProfileScreen.js'), /API Server URL|Test & Save/);
});

test('chat list safely renders structured last-message previews', () => {
  const chatList = read('src/screens/chat/ChatListScreen.js');
  assert.match(chatList, /typeof preview === 'object'/);
  assert.match(chatList, /String\(preview\.message/);
  assert.match(chatList, /getLastMessageText\(c\)\.toLowerCase/);
  assert.match(chatList, /lastMessageText \|\|/);
});

test('global search and notifications are registered', () => {
  const navigator = read('src/navigation/AppNavigator.js');
  assert.match(navigator, /name="GlobalSearch"/);
  assert.match(navigator, /name="Notifications"/);
  assert.match(read('src/screens/system/GlobalSearchScreen.js'), /\/search\?q=/);
  assert.match(read('src/screens/system/NotificationsScreen.js'), /\/notifications\/\$\{item\.id\}\/read/);
});
test('HR self-service remains available and retired field workforce is not registered', () => {
  const navigator = read('src/navigation/AppNavigator.js');
  const permissions = read('src/config/permissions.js');
  const hr = read('src/screens/employees/MyWorkScreen.js');
  assert.match(navigator, /name="MyWork"/);
  assert.doesNotMatch(navigator, /name="FieldWorkforce"/);
  assert.match(permissions, /MyWork: ALL_STAFF/);
  assert.match(hr, /\/my\/hr\?period=/);
  assert.match(hr, /\/my\/documents/);
  assert.match(hr, /\/leaves\/\$\{id\}\/status/);
});
