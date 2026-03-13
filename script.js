async function searchByTitle(title, apiKey, type, page = 1) {
    const params = new URLSearchParams({ apikey: apiKey, s: title, page: String(page) });
    if (type === 'movie' || type === 'series') params.set('type', type);
    const apiUrl = `https://www.omdbapi.com/?${params.toString()}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (response.ok && data.Response === 'True') {
            const totalResults = parseInt(data.totalResults, 10) || 0;
            const results = data.Search.map(item => ({
                Title: item.Title,
                Year: item.Year,
                imdbID: item.imdbID,
                Type: item.Type,
            }));
            return { results, totalResults };
        }
        return { results: [], totalResults: 0 };
    } catch (error) {
        console.error(`OMDb API Error: ${error.message}`);
        return { results: [], totalResults: 0 };
    }
}

async function getSeriesTotalSeasons(imdbID, apiKey) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?apikey=${apiKey}&i=${encodeURIComponent(imdbID)}`);
        const data = await response.json();
        if (response.ok && data.totalSeasons) return parseInt(data.totalSeasons, 10) || 0;
        return 0;
    } catch (error) {
        console.error(`OMDb API Error: ${error.message}`);
        return 0;
    }
}

const tmdbOptions = (apiKey) => ({
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: 'Bearer ' + apiKey
    }
});

async function getMovieDetails(imdbID, apiKey) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/find/${imdbID}?external_source=imdb_id`, tmdbOptions(apiKey));
        const data = await response.json();
        if (response.ok && data.movie_results && data.movie_results.length)
            return { movie: data.movie_results[0] };
        return null;
    } catch (error) {
        console.error(`TMDb API Error: ${error.message}`);
        return null;
    }
}

async function getSeriesDetails(imdbID, apiKey) {
    try {
        const response = await fetch(`https://api.themoviedb.org/3/find/${imdbID}?external_source=imdb_id`, tmdbOptions(apiKey));
        const data = await response.json();
        if (response.ok && data.tv_results && data.tv_results.length)
            return data.tv_results[0];
        return null;
    } catch (error) {
        console.error(`TMDb API Error: ${error.message}`);
        return null;
    }
}

const SEARCH_MODE_KEY = 'mode';
const PLACEHOLDERS = { movie: 'Search For a Movie', series: 'Search For a Series' };

const RECENT_MOVIE_SEARCHES_KEY = 'recentMovieSearches';
const RECENT_SERIES_SEARCHES_KEY = 'recentSeriesSearches';
const SEEN_MOVIES_KEY = 'seenMovies';
const MAX_RECENT_SEARCHES = 20;

function getRecentSearches(mode) {
    const key = mode === 'series' ? RECENT_SERIES_SEARCHES_KEY : RECENT_MOVIE_SEARCHES_KEY;
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function addRecentSearch(query, mode) {
    const q = query.trim();
    if (!q) return;
    const key = mode === 'series' ? RECENT_SERIES_SEARCHES_KEY : RECENT_MOVIE_SEARCHES_KEY;
    let list = getRecentSearches(mode);
    list = list.filter((s) => s.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    list = list.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(key, JSON.stringify(list));
}

function getSeenMovies() {
    try {
        const raw = localStorage.getItem(SEEN_MOVIES_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(arr);
    } catch {
        return new Set();
    }
}

function addSeenMovie(imdbID) {
    const set = getSeenMovies();
    set.add(imdbID);
    localStorage.setItem(SEEN_MOVIES_KEY, JSON.stringify([...set]));
}

function getSearchModeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get(SEARCH_MODE_KEY);
    return mode === 'series' ? 'series' : 'movie';
}

function setSearchModeInUrl(mode) {
    const url = new URL(window.location.href);
    url.searchParams.set(SEARCH_MODE_KEY, mode);
    window.history.replaceState({}, '', url.toString());
}

function getSearchMode() {
    return getSearchModeFromUrl();
}

function syncUiFromUrl() {
    const mode = getSearchModeFromUrl();
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const input = document.getElementById('movieTitle');
    if (input) input.placeholder = PLACEHOLDERS[mode];
}

const omdbApiKey = 'ca80bff0';
const tmdbApiKey = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZGZlNDUyYzY4M2U4ZDNjZmM1YjRmNGVmYjY3Mzg0NCIsInN1YiI6IjY1OTA2M2NhZjVmMWM1NzY5MDAwOWVmMCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.AX0llIBj3wsCy1WTjQdJ-y6VBGwYgWLiN-rDZ_5QXFM';

let currentSearchState = null;

function setResultsSummary(displayedCount, loading) {
    const el = document.getElementById('resultsSummary');
    if (!el) return;
    if (displayedCount === 0 && !loading) {
        el.textContent = '';
        el.style.display = 'none';
    } else {
        el.style.display = 'block';
        el.textContent = loading
            ? `Loading... Showing ${displayedCount} results so far`
            : `Showing ${displayedCount} results`;
    }
}


function dedupeById(items) {
    const seen = new Set();
    return items.filter(item => {
        if (seen.has(item.imdbID)) return false;
        seen.add(item.imdbID);
        return true;
    });
}

function createSkeletonCard(index) {
    const li = document.createElement('li');
    li.className = 'skeleton-card';
    li.dataset.skeletonIndex = String(index);
    const poster = document.createElement('div');
    poster.className = 'skeleton-poster';
    const line = document.createElement('div');
    line.className = 'skeleton-line';
    li.appendChild(poster);
    li.appendChild(line);
    return li;
}

function replaceSkeleton(resultsList, index, cardLi) {
    const skeleton = resultsList.querySelector(`.skeleton-card[data-skeleton-index="${index}"]`);
    if (!skeleton) return;
    if (cardLi) {
        skeleton.replaceWith(cardLi);
    } else {
        skeleton.remove();
    }
    const displayedCount = resultsList.querySelectorAll('li[data-imdb-id]').length;
    const loading = resultsList.querySelector('.skeleton-card') !== null;
    setResultsSummary(displayedCount, loading);
    if (!loading && displayedCount === 0 && !resultsList.querySelector('.results-empty-hint')) {
        const msg = document.createElement('li');
        msg.className = 'results-empty-hint';
        msg.textContent = 'No results could be displayed.';
        resultsList.appendChild(msg);
    }
}

function buildMovieCard(item, movie, seenMovies) {
    const listItem = document.createElement('li');
    listItem.dataset.imdbId = item.imdbID;
    const link = document.createElement('a');
    const img = document.createElement('img');
    const textContent = document.createElement('div');
    img.src = `https://image.tmdb.org/t/p/w185${movie.poster_path}`;
    img.alt = 'Movie Poster';
    textContent.textContent = `${item.Title}  (${item.Year})`;
    link.href = `https://vidsrc.me/embed/${item.imdbID}/`;
    link.target = '_blank';
    link.appendChild(img);
    link.appendChild(textContent);
    if (seenMovies.has(item.imdbID)) {
        listItem.classList.add('seen');
        const check = document.createElement('span');
        check.className = 'seen-check';
        check.setAttribute('aria-hidden', 'true');
        listItem.appendChild(link);
        listItem.appendChild(check);
    } else {
        listItem.appendChild(link);
    }
    link.addEventListener('click', () => addSeenMovie(item.imdbID));
    return listItem;
}

function buildSeriesCard(item, seriesDetails, totalSeasons) {
    const listItem = document.createElement('li');
    listItem.dataset.imdbId = item.imdbID;
    const link = document.createElement('a');
    link.href = `series.html?imdb=${encodeURIComponent(item.imdbID)}&tmdb=${seriesDetails.id}`;
    link.classList.add('series-card');
    const img = document.createElement('img');
    img.src = seriesDetails.poster_path ? `https://image.tmdb.org/t/p/w185${seriesDetails.poster_path}` : '';
    img.alt = item.Title;
    const textContent = document.createElement('div');
    textContent.textContent = `${item.Title} (${item.Year})`;
    const seasonInfo = document.createElement('div');
    seasonInfo.className = 'season-count';
    seasonInfo.textContent = totalSeasons ? `${totalSeasons} season${totalSeasons !== 1 ? 's' : ''}` : '';
    link.appendChild(img);
    link.appendChild(textContent);
    if (totalSeasons) link.appendChild(seasonInfo);
    listItem.appendChild(link);
    return listItem;
}

function searchAndDisplayResults() {
    const movieTitleInput = document.getElementById('movieTitle');
    const resultsList = document.getElementById('resultsList');
    const title = movieTitleInput.value.trim();
    const mode = getSearchMode();

    if (title === '') {
        alert('Please enter a title.');
        return;
    }

    const expectedType = mode === 'movie' ? 'movie' : 'series';
    addRecentSearch(title, mode);
    const seenMovies = getSeenMovies();
    resultsList.innerHTML = '';
    refreshRecentSearchesDropdown();

    searchByTitle(title, omdbApiKey, expectedType, 1).then(async ({ results: pageResults, totalResults }) => {
        const filtered = pageResults.filter(item => item.Type === expectedType);
        const deduped = dedupeById(filtered);

        if (deduped.length === 0 && totalResults === 0) {
            const listItem = document.createElement('li');
            listItem.textContent = 'No results found.';
            resultsList.appendChild(listItem);
            setResultsSummary(0, false);
            return;
        }

        let globalIndex = 0;
        const existingIds = new Set(deduped.map(item => item.imdbID));

        deduped.forEach((item, i) => {
            resultsList.appendChild(createSkeletonCard(globalIndex + i));
        });
        setResultsSummary(0, true);
        globalIndex += deduped.length;

        function resolveAndReplace(item, index) {
            if (mode === 'movie') {
                getMovieDetails(item.imdbID, tmdbApiKey).then((details) => {
                    const card = details && details.movie
                        ? buildMovieCard(item, details.movie, seenMovies)
                        : null;
                    replaceSkeleton(resultsList, index, card);
                });
            } else {
                getSeriesDetails(item.imdbID, tmdbApiKey).then(async (seriesDetails) => {
                    if (!seriesDetails) {
                        replaceSkeleton(resultsList, index, null);
                        return;
                    }
                    const totalSeasons = await getSeriesTotalSeasons(item.imdbID, omdbApiKey);
                    const card = buildSeriesCard(item, seriesDetails, totalSeasons);
                    replaceSkeleton(resultsList, index, card);
                });
            }
        }

        deduped.forEach((item, i) => resolveAndReplace(item, i));

        (async function loadRemainingPages() {
            let page = 2;
            while (true) {
                const { results: nextResults } = await searchByTitle(title, omdbApiKey, expectedType, page);
                const nextFiltered = nextResults.filter(item => item.Type === expectedType);
                const nextDeduped = nextDedupedById(nextFiltered, existingIds);
                if (nextDeduped.length === 0) break;

                nextDeduped.forEach((item) => existingIds.add(item.imdbID));
                nextDeduped.forEach((item, i) => {
                    resultsList.appendChild(createSkeletonCard(globalIndex + i));
                });
                setResultsSummary(resultsList.querySelectorAll('li[data-imdb-id]').length, true);
                nextDeduped.forEach((item, i) => resolveAndReplace(item, globalIndex + i));
                globalIndex += nextDeduped.length;

                if (nextResults.length < 10) break;
                page++;
            }
        })();
    });
}

function nextDedupedById(items, existingIds) {
    return items.filter(item => !existingIds.has(item.imdbID));
}

function refreshRecentSearchesDropdown() {
    const dropdown = document.getElementById('recentSearchesDropdown');
    const mode = getSearchMode();
    const list = getRecentSearches(mode);
    dropdown.innerHTML = '';
    dropdown.setAttribute('aria-hidden', 'true');
    if (list.length === 0) return;
    list.forEach((query) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'recent-search-item';
        row.textContent = query;
        row.dataset.query = query;
        row.addEventListener('click', () => {
            const input = document.getElementById('movieTitle');
            input.value = query;
            hideRecentSearchesDropdown();
            searchAndDisplayResults();
        });
        dropdown.appendChild(row);
    });
}

function showRecentSearchesDropdown() {
    const dropdown = document.getElementById('recentSearchesDropdown');
    const list = getRecentSearches(getSearchMode());
    if (list.length === 0) {
        dropdown.classList.remove('open');
        dropdown.setAttribute('aria-hidden', 'true');
        return;
    }
    refreshRecentSearchesDropdown();
    dropdown.classList.add('open');
    dropdown.setAttribute('aria-hidden', 'false');
}

function hideRecentSearchesDropdown() {
    const dropdown = document.getElementById('recentSearchesDropdown');
    dropdown.classList.remove('open');
    dropdown.setAttribute('aria-hidden', 'true');
}

(function setupRecentSearchesDropdown() {
    const input = document.getElementById('movieTitle');
    const dropdown = document.getElementById('recentSearchesDropdown');
    if (!input || !dropdown) return;
    input.addEventListener('focus', () => showRecentSearchesDropdown());
    input.addEventListener('input', () => {
        if (getRecentSearches(getSearchMode()).length) showRecentSearchesDropdown();
        else hideRecentSearchesDropdown();
    });
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target))
            hideRecentSearchesDropdown();
    });
})();

document.getElementById('movieTitle').addEventListener('keyup', function (event) {
    if (event.key === 'Enter') searchAndDisplayResults();
});

document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const mode = this.dataset.mode;
        setSearchModeInUrl(mode);
        syncUiFromUrl();
        const resultsList = document.getElementById('resultsList');
        if (resultsList) resultsList.innerHTML = '';
        const input = document.getElementById('movieTitle');
        if (input) input.value = '';
        currentSearchState = null;
        setResultsSummary(0, false);
    });
});

(function initSearchMode() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(SEARCH_MODE_KEY)) setSearchModeInUrl('movie');
    syncUiFromUrl();
})();
window.addEventListener('popstate', syncUiFromUrl);
