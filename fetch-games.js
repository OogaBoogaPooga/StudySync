const fs = require('fs');

async function fetchGames() {
  console.log('Fetching game list from GitHub API...');
  const res = await fetch('https://api.github.com/repos/DopeSkinnyKid27/3kh0-lite/contents/projects');
  const data = await res.json();

  if (!Array.isArray(data)) {
    console.error('❌ Error fetching from GitHub:', data.message || 'Unknown error');
    return;
  }

  const slugs = data
    .filter(item => item.type === 'dir')
    .map(item => item.name);

  fs.writeFileSync('/tmp/slugs.txt', slugs.join(' '));
  console.log('✅ Found ' + slugs.length + ' exact game folders.');
}

fetchGames();
