const TMDB_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4ZGZlNDUyYzY4M2U4ZDNjZmM1YjRmNGVmYjY3Mzg0NCIsInN1YiI6IjY1OTA2M2NhZjVmMWM1NzY5MDAwOWVmMCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.AX0llIBj3wsCy1WTjQdJ-y6VBGwYgWLiN-rDZ_5QXFM';

const SEEN_EPISODES_KEY = 'seenEpisodes';

function episodeKey(imdbId, season, episode) {
    return `${imdbId}:${season}:${episode}`;
}

function getSeenEpisodes() {
    try {
        const raw = localStorage.getItem(SEEN_EPISODES_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return new Set(arr);
    } catch {
        return new Set();
    }
}

function addSeenEpisode(imdbId, season, episode) {
    const set = getSeenEpisodes();
    set.add(episodeKey(imdbId, season, episode));
    localStorage.setItem(SEEN_EPISODES_KEY, JSON.stringify([...set]));
}

const tmdbOptions = {
    method: 'GET',
    headers: {
        accept: 'application/json',
        Authorization: 'Bearer ' + TMDB_API_KEY
    }
};

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        imdb: params.get('imdb') || '',
        tmdb: params.get('tmdb') ? parseInt(params.get('tmdb'), 10) : null
    };
}

async function getTvIdFromImdb(imdbId) {
    const response = await fetch(
        `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
        tmdbOptions
    );
    const data = await response.json();
    if (response.ok && data.tv_results && data.tv_results.length)
        return data.tv_results[0].id;
    return null;
}

async function getTvDetails(tvId) {
    const response = await fetch(
        `https://api.themoviedb.org/3/tv/${tvId}`,
        tmdbOptions
    );
    const data = await response.json();
    if (response.ok) return data;
    return null;
}

async function getSeasonDetails(tvId, seasonNumber) {
    const response = await fetch(
        `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}`,
        tmdbOptions
    );
    const data = await response.json();
    if (response.ok && data.episodes) return data.episodes;
    return [];
}

const EPISODE_FALLBACK_ICON = '&#9654;';

function renderEpisodes(episodes, imdbId, seasonNumber, container) {
    container.innerHTML = '';
    const seenEpisodes = getSeenEpisodes();
    if (!episodes.length) {
        const li = document.createElement('li');
        li.textContent = 'No episodes found for this season.';
        container.appendChild(li);
        return;
    }
    for (const ep of episodes) {
        const key = episodeKey(imdbId, seasonNumber, ep.episode_number);
        const seen = seenEpisodes.has(key);
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `https://vidsrc.me/embed/tv?imdb=${encodeURIComponent(imdbId)}&season=${seasonNumber}&episode=${ep.episode_number}`;
        link.target = '_blank';
        link.className = 'episode-card';

        if (ep.still_path) {
            const img = document.createElement('img');
            img.src = `https://image.tmdb.org/t/p/w185${ep.still_path}`;
            img.alt = ep.name || `Episode ${ep.episode_number}`;
            img.className = 'episode-poster';
            link.appendChild(img);
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'episode-poster-fallback';
            fallback.innerHTML = EPISODE_FALLBACK_ICON;
            link.appendChild(fallback);
        }

        const meta = document.createElement('div');
        meta.className = 'episode-meta';
        meta.textContent = `S${seasonNumber}E${ep.episode_number}`;
        link.appendChild(meta);

        const name = document.createElement('div');
        name.className = 'episode-name';
        name.textContent = ep.name || `Episode ${ep.episode_number}`;
        link.appendChild(name);

        if (seen) {
            li.classList.add('seen');
            li.appendChild(link);
            const check = document.createElement('span');
            check.className = 'seen-check';
            check.setAttribute('aria-hidden', 'true');
            li.appendChild(check);
        } else {
            li.appendChild(link);
        }
        link.addEventListener('click', () => addSeenEpisode(imdbId, seasonNumber, ep.episode_number));
        container.appendChild(li);
    }
}

function initSeasonSelect(numberOfSeasons, imdbId, tvId, episodesList) {
    const select = document.getElementById('seasonSelect');
    select.innerHTML = '';
    for (let i = 1; i <= numberOfSeasons; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Season ${i}`;
        select.appendChild(opt);
    }

    async function loadSeason(seasonNum) {
        const episodes = await getSeasonDetails(tvId, seasonNum);
        renderEpisodes(episodes, imdbId, seasonNum, episodesList);
    }

    select.addEventListener('change', () => loadSeason(parseInt(select.value, 10)));
    loadSeason(1);
}

async function init() {
    const { imdb, tmdb } = getUrlParams();
    const titleEl = document.getElementById('seriesTitle');
    const seasonSelect = document.getElementById('seasonSelect');
    const episodesList = document.getElementById('episodesList');

    if (!imdb) {
        titleEl.textContent = 'Missing series (no imdb id).';
        return;
    }

    let tvId = tmdb;
    if (tvId == null) {
        tvId = await getTvIdFromImdb(imdb);
    }
    if (tvId == null) {
        titleEl.textContent = 'Series not found.';
        return;
    }

    const details = await getTvDetails(tvId);
    if (!details) {
        titleEl.textContent = 'Could not load series details.';
        return;
    }

    const name = details.name || 'Series';
    const numberOfSeasons = details.number_of_seasons || 1;
    titleEl.textContent = name;

    initSeasonSelect(numberOfSeasons, imdb, tvId, episodesList);
}

init();
