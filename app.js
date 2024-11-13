console.log('wiki starter');

const searchUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=20&format=json&origin=*&srsearch=';
const imageUrl = 'https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&piprop=thumbnail&pithumbsize=150&origin=*&titles=';

const formDOM = document.querySelector('.form');
const inputDOM = formDOM.querySelector('.form-input');
const resultsDOM = document.querySelector('.results');
const languageSelect = document.querySelector('.language-select');
const searchHistoryList = document.querySelector('.search-history');

// Tambahkan state untuk riwayat pencarian
let searchHistory = JSON.parse(localStorage.getItem('wikiSearchHistory')) || [];

// Tambahkan konstanta untuk read later storage
const READ_LATER_KEY = 'wikiReadLater';

// Fungsi untuk menyimpan riwayat pencarian
const saveSearchHistory = (searchTerm) => {
  if (!searchHistory.includes(searchTerm)) {
    searchHistory = [searchTerm, ...searchHistory].slice(0, 5);
    localStorage.setItem('wikiSearchHistory', JSON.stringify(searchHistory));
    displaySearchHistory();
  }
};

// Fungsi untuk menampilkan riwayat pencarian
const displaySearchHistory = () => {
  if (searchHistoryList) {
    const historyItems = searchHistory
      .map(
        (term) => `
        <li class="history-item">
          <button class="history-btn" data-term="${term}">${term}</button>
          <button class="delete-btn" data-term="${term}">×</button>
        </li>
      `
      )
      .join('');
    searchHistoryList.innerHTML = historyItems;
  }
};

// Fungsi untuk debounce pencarian
const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

// Fungsi untuk copy link artikel
const copyArticleLink = (pageid) => {
  const link = `http://en.wikipedia.org/?curid=${pageid}`;
  navigator.clipboard.writeText(link).then(() => {
    showNotification('Link copied to clipboard!');
  });
};

// Fungsi untuk menampilkan notifikasi
const showNotification = (message) => {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
};

// Tambahkan container untuk form input dan clear button
formDOM.innerHTML = `
  <div class="search-container">
    <input type="text" class="form-input" />
    <button type="button" class="clear-search-btn">×</button>
  </div>
`;

// Update referensi DOM setelah mengubah HTML
const newInputDOM = formDOM.querySelector('.form-input');
const clearSearchBtn = formDOM.querySelector('.clear-search-btn');

// Event listener untuk clear button
clearSearchBtn.addEventListener('click', () => {
  newInputDOM.value = '';
  resultsDOM.innerHTML = '';
  clearSearchBtn.style.display = 'none';
});

// Update event listener untuk input
newInputDOM.addEventListener(
  'input',
  debounce((e) => {
    const value = e.target.value;
    clearSearchBtn.style.display = value ? 'block' : 'none';
    if (value.length >= 3) {
      fetchResults(value);
    }
  }, 500)
);

// Event listener untuk form submission
formDOM.addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = newInputDOM.value;
  if (!value) {
    resultsDOM.innerHTML = '<div class="error">please enter valid search term</div>';
    return;
  }

  showLoading();
  saveSearchHistory(value);
  await fetchResults(value);
});

// Event listener untuk riwayat pencarian
if (searchHistoryList) {
  searchHistoryList.addEventListener('click', (e) => {
    if (e.target.classList.contains('history-btn')) {
      const term = e.target.dataset.term;
      inputDOM.value = term;
      fetchResults(term);
    }
    if (e.target.classList.contains('delete-btn')) {
      const term = e.target.dataset.term;
      searchHistory = searchHistory.filter(item => item !== term);
      localStorage.setItem('wikiSearchHistory', JSON.stringify(searchHistory));
      displaySearchHistory();
    }
  });
}

// Render function yang diperbarui
const renderResults = (list) => {
  const cardsList = list
    .map((item) => {
      const { title, snippet, pageid, thumbnail } = item;
      const cleanSnippet = snippet.replace(/(<([^>]+)>)/gi, '');
      
      return `
        <div class="article-card">
          <div class="article-content">
            ${thumbnail ? 
              `<div class="article-image">
                <img src="${thumbnail}" alt="${title}" loading="lazy">
               </div>` : 
              ''
            }
            <div class="article-info">
              <h4>${title}</h4>
              <p>${cleanSnippet}</p>
              <div class="article-actions">
                <a href="http://en.wikipedia.org/?curid=${pageid}" target="_blank" class="read-btn">Read Article</a>
                <button class="copy-btn" onclick="copyArticleLink('${pageid}')">Copy Link</button>
                <button class="share-btn" onclick="shareArticle('${pageid}', '${title}')">Share</button>
                <button class="reading-mode-btn" onclick="toggleReadingMode(this.closest('.article-card'))">📖</button>
                <button class="save-read-later-btn" onclick="saveReadLaterArticle({
                  title: '${title.replace(/'/g, "\\'")}',
                  snippet: '${cleanSnippet.replace(/'/g, "\\'")}',
                  pageid: '${pageid}',
                  thumbnail: '${thumbnail || ''}'
                })">
                  📑 Save for Later
                </button>
              </div>
            </div>
          </div>
        </div>`;
    })
    .join('');
    
  resultsDOM.innerHTML = `
    <div class="results-info">Found ${list.length} results</div>
    <div class="articles">${cardsList}</div>
  `;
};

// Fungsi untuk sharing artikel
const shareArticle = async (pageid, title) => {
  const shareData = {
    title: `Wikipedia: ${title}`,
    text: `Check out this Wikipedia article about ${title}`,
    url: `http://en.wikipedia.org/?curid=${pageid}`
  };

  try {
    if (navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      showNotification('Article shared successfully!');
    } else {
      copyArticleLink(pageid);
    }
  } catch (err) {
    console.error('Error sharing:', err);
    showNotification('Unable to share article');
  }
};

const showLoading = () => {
  resultsDOM.innerHTML = '<div class="loading"></div>';
};

const fetchResults = async (searchTerm) => {
  try {
    const searchValue = encodeURIComponent(searchTerm);
    const response = await fetch(`${searchUrl}${searchValue}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    const results = data.query.search;

    if (results.length < 1) {
      resultsDOM.innerHTML = '<div class="error">no matching results. Please try again</div>';
      return;
    }

    const resultsWithImages = await Promise.all(
      results.map(async (result) => {
        const imageData = await fetchImage(result.title);
        return { ...result, thumbnail: imageData };
      })
    );

    renderResults(resultsWithImages);
  } catch (error) {
    console.error('Error:', error);
    resultsDOM.innerHTML = '<div class="error">there was an error...</div>';
  }
};

const fetchImage = async (title) => {
  try {
    const response = await fetch(`${imageUrl}${encodeURIComponent(title)}`);
    const data = await response.json();
    const pages = data.query.pages;
    const firstPage = pages[Object.keys(pages)[0]];
    return firstPage.thumbnail?.source || null;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
};

// Theme Toggling Functionality
const themeToggle = document.querySelector('.theme-toggle');
const toggleIcon = document.querySelector('.toggle-icon');

// Check for saved theme preference
const getCurrentTheme = () => {
  return localStorage.getItem('theme') || 'light';
};

// Apply theme to document
const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  // Update toggle icon
  toggleIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
};

// Initialize theme
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = getCurrentTheme();
  applyTheme(savedTheme);
});

// Handle theme toggle click
themeToggle.addEventListener('click', () => {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
});

const toggleReadingMode = (articleCard) => {
  articleCard.classList.toggle('reading-mode');
  if (articleCard.classList.contains('reading-mode')) {
    articleCard.style.maxWidth = '800px';
    articleCard.style.margin = '0 auto';
    articleCard.style.fontSize = '1.2rem';
    articleCard.style.lineHeight = '1.8';
    articleCard.style.padding = '2rem';
  } else {
    articleCard.style = '';
  }
};

const randomArticleUrl = 'https://en.wikipedia.org/w/api.php?action=query&list=random&rnlimit=1&format=json&origin=*';

const fetchRandomArticle = async () => {
  try {
    showLoading();
    const response = await fetch(randomArticleUrl);
    const data = await response.json();
    const randomArticle = data.query.random[0];
    const results = [{
      title: randomArticle.title,
      pageid: randomArticle.id,
      snippet: 'Loading random article...'
    }];
    
    const resultsWithImages = await Promise.all(
      results.map(async (result) => {
        const imageData = await fetchImage(result.title);
        return { ...result, thumbnail: imageData };
      })
    );

    renderResults(resultsWithImages);
  } catch (error) {
    console.error('Error:', error);
    resultsDOM.innerHTML = '<div class="error">Failed to fetch random article</div>';
  }
};

// Tambahkan fungsi untuk mengelola artikel baca nanti
const getReadLaterArticles = () => {
  return JSON.parse(localStorage.getItem(READ_LATER_KEY)) || [];
};

const saveReadLaterArticle = (article) => {
  const readLater = getReadLaterArticles();
  const exists = readLater.some(item => item.pageid === article.pageid);
  
  if (!exists) {
    readLater.push(article);
    localStorage.setItem(READ_LATER_KEY, JSON.stringify(readLater));
    showNotification('Article saved to Read Later');
    displayReadLaterArticles(); // Refresh tampilan setelah menyimpan
  } else {
    showNotification('Article already in Read Later');
  }
};

const removeReadLaterArticle = (pageid) => {
  const readLater = getReadLaterArticles();
  const filtered = readLater.filter(item => item.pageid !== pageid);
  localStorage.setItem(READ_LATER_KEY, JSON.stringify(filtered));
  showNotification('Article removed from Read Later');
  displayReadLaterArticles();
};

// Tambahkan fungsi untuk menampilkan artikel baca nanti
const displayReadLaterArticles = () => {
  const readLaterContainer = document.querySelector('.read-later-articles');
  if (!readLaterContainer) return;

  const articles = getReadLaterArticles();
  
  if (articles.length === 0) {
    readLaterContainer.innerHTML = '<p>No saved articles</p>';
    return;
  }

  const articlesHTML = articles
    .map(
      (article) => `
        <div class="article-card">
          <div class="article-content">
            ${article.thumbnail ? 
              `<div class="article-image">
                <img src="${article.thumbnail}" alt="${article.title}" loading="lazy">
               </div>` : 
              ''
            }
            <div class="article-info">
              <h4>${article.title}</h4>
              <p>${article.snippet}</p>
              <div class="article-actions">
                <a href="http://en.wikipedia.org/?curid=${article.pageid}" target="_blank" class="read-btn">Read Article</a>
                <button class="remove-read-later-btn" onclick="removeReadLaterArticle('${article.pageid}')">
                  <span>🗑️ Remove</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `
    )
    .join('');

  readLaterContainer.innerHTML = articlesHTML;
};

// Tambahkan event listener untuk memuat Read Later articles saat halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
  displayReadLaterArticles();
  displaySearchHistory();
});
