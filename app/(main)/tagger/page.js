"use client";

import React, { useEffect, useRef, useState } from 'react';
import styles from './Tagger.module.css';
import FileDrop from '../FileDrop/FileDrop';
import { useColorContext } from '../ColorContext';
import { GripVertical } from 'lucide-react';

// Helper: Extract Discogs type and ID from URL
function parseDiscogsUrl(url) {
  // Examples:
  // https://www.discogs.com/release/1234567-Artist-Title
  // https://www.discogs.com/master/7654321-Artist-Title
  const releaseMatch = url.match(/discogs\.com\/(release|master)\/(\d+)/i);
  if (releaseMatch) {
    return { type: releaseMatch[1].toLowerCase(), id: releaseMatch[2] };
  }
  return null;
}

// Log backend request/response for Discogs
function logDiscogsRequest({ route, payload, response }) {
  console.log('[Discogs API Request]');
  console.log('Route:', route);
  console.log('Payload:', payload);
  console.log('Response:', response);
}

export default function TaggerPage() {
  const { colors } = useColorContext();
  const urlInputContainerRef = useRef(null);
  const [isStacked, setIsStacked] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [debugInfo, setDebugInfo] = useState({ url: '', files: [] });
  const [copyState, setCopyState] = useState('idle'); // idle | copied | hover
  const [discogsResponse, setDiscogsResponse] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [tagsValue, setTagsValue] = useState('');
  const [tagsCopyState, setTagsCopyState] = useState('idle'); // idle | copied | hover
  // Add new states for tag optimization
  const [charLimit, setCharLimit] = useState('500');
  const [optimizeStatus, setOptimizeStatus] = useState(''); // For feedback messages
  const [tagFilters, setTagFilters] = useState({
    artists: { enabled: true, percentage: 100, count: 0, totalChars: 0 },
    album: { enabled: true, percentage: 100, count: 0, totalChars: 0 },
    tracklist: { enabled: true, percentage: 100, count: 0, totalChars: 0 },
    combinations: { enabled: true, percentage: 100, count: 0, totalChars: 0 }
  });
  const [selectAllTags, setSelectAllTags] = useState(true);
  // Add hydration state
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isClient, setIsClient] = useState(false); // Track if we're on the client side

  // Add the missing parsedTags state
  const [parsedTags, setParsedTags] = useState({
    artists: [],
    album: [],
    tracklist: [],
    combinations: []
  });

  const [formatOrder, setFormatOrder] = useState([
    { id: 1, value: 'startTime' },
    { id: 2, value: 'dash' },
    { id: 3, value: 'endTime' },
    { id: 4, value: 'title' },
    { id: 5, value: 'dash-artist' }, // new dash before artist
    { id: 6, value: 'artist' }
  ]);

  const [selectOptions, setSelectOptions] = useState([
    [
      { value: 'startTime', label: 'start' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'dash', label: '-' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'endTime', label: 'end' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'title', label: 'title' }
    ],
    [
      { value: 'dash-artist', label: '-' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'artist', label: 'artist' },
      { value: 'blank', label: '(blank)' }
    ]
  ]);

  // Default values for reset
  const defaultFormatOrder = [
    { id: 1, value: 'startTime' },
    { id: 2, value: 'dash' },
    { id: 3, value: 'endTime' },
    { id: 4, value: 'title' },
    { id: 5, value: 'dash-artist' },
    { id: 6, value: 'artist' }
  ];
  const defaultSelectOptions = [
    [
      { value: 'startTime', label: 'start' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'dash', label: '-' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'endTime', label: 'end' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'title', label: 'title' }
    ],
    [
      { value: 'dash-artist', label: '-' },
      { value: 'blank', label: '(blank)' }
    ],
    [
      { value: 'artist', label: 'artist' },
      { value: 'blank', label: '(blank)' }
    ]
  ];

  // Set artist dropdown disabled by default
  const [artistDisabled, setArtistDisabled] = useState(true);

  // Formatting suggestion state
  const [formatSuggestion, setFormatSuggestion] = useState(null);

  // Store last audioFiles/durations for dynamic textarea update
  const audioFilesRef = useRef([]);
  const durationsRef = useRef([]);

  // Store last Discogs tracks/durations for dynamic textarea update
  const discogsTracksRef = useRef([]);
  const discogsDurationsRef = useRef([]);
  // Track input source: 'files' | 'discogs' | null
  const [inputSource, setInputSource] = useState(null);

  // Load formatOrder/selectOptions/inputValue/artistDisabled from localStorage on mount (client only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    setIsClient(true); // Set client flag
    
    try {
      const savedOrder = localStorage.getItem('tagger_formatOrder');
      const savedOptions = localStorage.getItem('tagger_selectOptions');
      const savedInputValue = localStorage.getItem('tagger_inputValue');
      const savedArtistDisabled = localStorage.getItem('tagger_artistDisabled');
      if (savedOrder) setFormatOrder(JSON.parse(savedOrder));
      if (savedOptions) setSelectOptions(JSON.parse(savedOptions));
      if (savedInputValue) setInputValue(savedInputValue);
      if (savedArtistDisabled !== null) setArtistDisabled(savedArtistDisabled === 'true');
    } finally {
      setHasHydrated(true); // Mark hydration complete
    }
  }, []);

  // Save formatOrder/selectOptions/inputValue/artistDisabled to localStorage on change (client only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('tagger_formatOrder', JSON.stringify(formatOrder));
      localStorage.setItem('tagger_selectOptions', JSON.stringify(selectOptions));
      localStorage.setItem('tagger_inputValue', inputValue);
      localStorage.setItem('tagger_artistDisabled', String(artistDisabled));
    } catch {}
  }, [formatOrder, selectOptions, inputValue, artistDisabled]);

  const handleSelectChange = (idx, val) => {
    setFormatOrder((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], value: val };
      return updated;
    });
  };

  // Helper to format seconds as mm:ss
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Helper to get audio duration from a File
  function getAudioDuration(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const audio = new window.Audio();
      audio.src = url;
      audio.addEventListener('loadedmetadata', () => {
        resolve(audio.duration);
        URL.revokeObjectURL(url);
      });
      audio.addEventListener('error', (e) => {
        reject(e);
        URL.revokeObjectURL(url);
      });
    });
  }

  // Handle files: get durations, build tracklist, update debug
  const handleFilesSelected = async (files) => {
    setIsLoadingFiles(true);
    const fileArr = Array.from(files);
    setDebugInfo(prev => ({
      ...prev,
      files: fileArr.map(f => f.name)
    }));

    // Only process audio files
    const audioFiles = fileArr.filter(f =>
      f.type.startsWith('audio/') ||
      /\.(mp3|wav|aiff|flac)$/i.test(f.name)
    );

    // Get durations for each file
    const durations = await Promise.all(audioFiles.map(async (file) => {
      try {
        const duration = await getAudioDuration(file);
        return duration;
      } catch {
        return 0;
      }
    }));

    // Store for later use in dropdown changes
    audioFilesRef.current = audioFiles;
    durationsRef.current = durations;
    discogsTracksRef.current = [];
    discogsDurationsRef.current = [];
    setInputSource('files');

    // Build tracklist lines
    let currentTime = 0;
    const lines = audioFiles.map((file, idx) => {
      const start = formatTime(currentTime);
      const end = formatTime(currentTime + durations[idx]);
      const title = file.name.replace(/\.[^/.]+$/, '');
      currentTime += durations[idx];

      return formatOrder
        .map((item) => {
          if (item.value === 'blank') return '';
          if (item.value === 'startTime') return start;
          if (item.value === 'endTime') return end;
          if (item.value === 'title' ) return title;
          if (item.value === 'dash' ) return '-';
          if (item.value === 'dash-artist' ) return artistDisabled ? '' : '-';
          if (item.value === 'artist') return '';
          return '';
        })
        .filter(Boolean)
        .join(' ');
    });

    setInputValue(lines.join('\n'));
    setIsLoadingFiles(false);
  };

  // Update textarea when dropdowns change and audioFilesRef/discogsTracksRef is set
  useEffect(() => {
    // Helper: check if dash-artist dropdown is present and enabled
    const dashArtistIdx = formatOrder.findIndex(item => item.value === 'dash-artist');
    const dashArtistEnabled = dashArtistIdx !== -1 && !artistDisabled;
    if (inputSource === 'files' && audioFilesRef.current.length > 0) {
      let currentTime = 0;
      const lines = audioFilesRef.current.map((file, idx) => {
        const start = formatTime(currentTime);
        const end = formatTime(currentTime + (durationsRef.current[idx] || 0));
        const title = file.name.replace(/\.[^/.]+$/, '');
        currentTime += durationsRef.current[idx] || 0;
        return formatOrder
          .map((item) => {
            if (item.value === 'blank') return '';
            if (item.value === 'startTime') return start;
            if (item.value === 'endTime') return end;
            if (item.value === 'title' ) return title;
            if (item.value === 'dash' ) return '-';
            if (item.value === 'dash-artist' ) return dashArtistEnabled ? '-' : '';
            if (item.value === 'artist') return '';
            return '';
          })
          .filter(Boolean)
          .join(' ');
      });
      setInputValue(lines.join('\n'));
    } else if (inputSource === 'discogs' && discogsTracksRef.current.length > 0) {
      let currentTime = 0;
      const lines = discogsTracksRef.current.map((track, idx) => {
        const durationSec = discogsDurationsRef.current[idx] || 0;
        const start = formatTime(currentTime);
        const end = formatTime(currentTime + durationSec);
        currentTime += durationSec;
        // Get artist name for this track if present
        let artistName = '';
        if (Array.isArray(track.artists) && track.artists.length > 0 && track.artists[0].name) {
          artistName = track.artists.map(a => a.name).join(', ');
        }
        return formatOrder
          .map(item => {
            if (item.value === 'blank') return '';
            if (item.value === 'startTime') return start;
            if (item.value === 'endTime') return end;
            if (item.value === 'title' ) return track.title || '';
            if (item.value === 'dash' ) return '-'; // Fixed: removed extra quote
            if (item.value === 'dash-artist' ) return dashArtistEnabled ? '-' : '';
            if (item.value === 'artist') return artistName;
            return '';
          })
          .filter(Boolean)
          .join(' ');
      });
      setInputValue(lines.join('\n'));
    }
    // eslint-disable-next-line
  }, [formatOrder]);

  // Update textarea when dropdowns change and audioFilesRef/discogsTracksRef/inputValue is set
  useEffect(() => {
    // Helper: check if dash-artist dropdown is present and enabled
    const dashArtistIdx = formatOrder.findIndex(item => item.value === 'dash-artist');
    const dashArtistEnabled = dashArtistIdx !== -1 && !artistDisabled;
    // If we have discogsTracksRef or audioFilesRef, use those for accurate data
    if (inputSource === 'files' && audioFilesRef.current.length > 0) {
      let currentTime = 0;
      const newLines = audioFilesRef.current.map((file, idx) => {
        const start = formatTime(currentTime);
        const end = formatTime(currentTime + (durationsRef.current[idx] || 0));
        const title = file.name.replace(/\.[^/.]+$/, '');
        currentTime += durationsRef.current[idx] || 0;
        return formatOrder
          .map((item) => {
            if (item.value === 'blank') return '';
            if (item.value === 'startTime') return start;
            if (item.value === 'endTime') return end;
            if (item.value === 'title' ) return title;
            if (item.value === 'dash' ) return '-';
            if (item.value === 'dash-artist' ) return dashArtistEnabled ? '-' : '';
            if (item.value === 'artist') return '';
            return '';
          })
          .filter(Boolean)
          .join(' ');
      });
      setInputValue(newLines.join('\n'));
    } else if (inputSource === 'discogs' && discogsTracksRef.current.length > 0) {
      let currentTime = 0;
      const newLines = discogsTracksRef.current.map((track, idx) => {
        const durationSec = discogsDurationsRef.current[idx] || 0;
        const start = formatTime(currentTime);
        const end = formatTime(currentTime + durationSec);
        currentTime += durationSec;
        let artistName = '';
        if (Array.isArray(track.artists) && track.artists.length > 0 && track.artists[0].name) {
          artistName = track.artists.map(a => a.name).join(', ');
        }
        return formatOrder
          .map(item => {
            if (item.value === 'blank') return '';
            if (item.value === 'startTime' ) return start;
            if (item.value === 'endTime' ) return end;
            if (item.value === 'title' ) return track.title || '';
            if (item.value === 'dash' ) return '-'; // Fixed: removed extra quote
            if (item.value === 'dash-artist' ) return dashArtistEnabled ? '-' : '';
            if (item.value === 'artist') return artistName;
            return '';
          })
          .filter(Boolean)
          .join(' ');
      });
      setInputValue(newLines.join('\n'));
    }
    // eslint-disable-next-line
  }, [formatOrder, artistDisabled, inputSource]);

  // Detect duplicate prefix in textarea and show suggestion
  useEffect(() => {
    // Only run if textarea has at least 2 lines
    const lines = inputValue.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setFormatSuggestion(null);
      return;
    }
    // Improved: Remove all leading timestamps, dashes, and track numbers
    const getTitlePart = (line) => {
      // Remove all leading timestamps (e.g. 00:00, 02:01), dashes, and track numbers
      // Matches: 00:00 - 02:01 03 Alan Burn - Plaything
      //          00:00 05 Alan Burn - Beach House
      //          02:01 - 04:10 04 Alan Burn - That's How It All Began
      //          02:16 06 Alan Burn - Somebody Wrote Their Name
      // Regex: ^((\d{2}:\d{2}\s*(-\s*)?)+)?(\d{2}\s+)?-?\s*
      return line.replace(/^((\d{2}:\d{2}\s*(-\s*)?)+)?(\d{2}\s+)?-?\s*/i, '');
    };
    const titleParts = lines.map(getTitlePart);
    // Only consider suggestion if all lines have a non-empty title part
    if (titleParts.length < 2 || titleParts.some(t => !t.trim())) {
      setFormatSuggestion(null);
      return;
    }
    // Find common prefix (case-insensitive)
    function commonPrefix(arr) {
      if (!arr.length) return '';
      let prefix = arr[0];
      for (let i = 1; i < arr.length; i++) {
        while (
          arr[i].toLowerCase().indexOf(prefix.toLowerCase()) !== 0 &&
          prefix.length > 0
        ) {
          prefix = prefix.slice(0, -1);
        }
        if (!prefix) break;
      }
      return prefix;
    }
    const prefix = commonPrefix(titleParts);
    // Only suggest if prefix is at least 3 chars and appears in all lines
    if (
      prefix &&
      prefix.length >= 3 &&
      titleParts.every(t => t.toLowerCase().startsWith(prefix.toLowerCase()))
    ) {
      setFormatSuggestion({
        prefix,
        before: lines.join('\n'),
        after: lines.map(line => {
          // Remove only the first occurrence of the prefix after the time/dash/track
          const rest = getTitlePart(line);
          const replaced = rest.replace(new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
          // Rebuild the line with the original prefix removed
          return line.replace(rest, replaced);
        }).join('\n')
      });
    } else {
      setFormatSuggestion(null);
    }
  }, [inputValue, formatOrder, selectOptions]);

  const handleCopy = () => {
    navigator.clipboard.writeText(inputValue ? `Timestamps generated by https://tagger.site:\n${inputValue}` : '');
    setCopyState('copied');
    setTimeout(() => setCopyState('idle'), 900);
  };

  // Handle tags copy
  const handleTagsCopy = () => {
    navigator.clipboard.writeText(tagsValue);
    setTagsCopyState('copied');
    setTimeout(() => setTagsCopyState('idle'), 900);
  };

  // New function to optimize tags based on character limit
  const optimizeTags = () => {
    const limit = parseInt(charLimit, 10);
    if (isNaN(limit) || limit <= 0) {
      setOptimizeStatus('Please enter a valid character limit');
      return;
    }

    // Get current tags and split by comma
    const currentTags = tagsValue.split(',').map(tag => tag.trim()).filter(Boolean);
    
    if (currentTags.length === 0) {
      setOptimizeStatus('No tags to optimize');
      return;
    }

    // Calculate current character count (including commas)
    const currentCharCount = tagsValue.length;
    
    if (currentCharCount <= limit) {
      setOptimizeStatus(`Already within limit (${currentCharCount}/${limit} chars)`);
      return;
    }

    // Rank tags by priority (multi-word tags, unique terms, years, etc.)
    const rankedTags = currentTags.map(tag => {
      // Calculate a score for each tag
      let score = 0;
      
      // Multi-word tags are often more specific and valuable
      const wordCount = tag.split(/\s+/).length;
      score += wordCount * 2;
      
      // Tags containing years often provide context
      if (/\b(19|20)\d{2}\b/.test(tag)) {
        score += 3;
      }
      
      // Prioritize medium-length tags that provide info without being too long
      if (tag.length > 3 && tag.length < 15) {
        score += 2;
      }
      
      // Penalize very short or very long tags
      if (tag.length <= 2) {
        score -= 2;
      }
      
      // Prioritize album and artist names (these tend to be more important for search)
      if (parsedTags.artists.includes(tag) || parsedTags.album.includes(tag)) {
        score += 5;
      }
      
      return { tag, score };
    });

    // Sort tags by score (highest first)
    rankedTags.sort((a, b) => b.score - a.score);

    // Start building optimized tag list
    const optimizedTags = [];
    let charCount = 0;

    // Add tags until we reach the limit
    for (const { tag } of rankedTags) {
      // Calculate length including comma if it's not the first tag
      const tagLength = optimizedTags.length ? tag.length + 1 : tag.length;
      
      if (charCount + tagLength <= limit) {
        optimizedTags.push(tag);
        charCount += tagLength;
      } else {
        // We've reached the limit
        break;
      }
    }

    // Update the tags textarea
    setTagsValue(optimizedTags.join(','));
    setOptimizeStatus(`Optimized: ${optimizedTags.length}/${currentTags.length} tags kept (${charCount}/${limit} chars)`);
    
    // Clear status message after a few seconds
    setTimeout(() => setOptimizeStatus(''), 5000);
  };

  // Method to apply formatting suggestion
  const applyFormatSuggestion = () => {
    if (formatSuggestion) {
      setInputValue(formatSuggestion.after);
      setFormatSuggestion(null);
    }
  };

  // New function to parse Discogs response into tag categories
  const processDiscogsResponseToTags = (response) => {
    if (!response) return;
    
    // Helper function to clean Discogs entity names by removing (number) suffixes
    const cleanDiscogsSuffix = (name) => {
      if (!name) return '';
      // Regex to match " (123)" at the end of a string - space, open parenthesis, digits, close parenthesis
      return name.replace(/\s+\(\d+\)$/, '');
    };
    
    const tagCategories = {
      artists: new Set(),
      album: new Set(),
      tracklist: new Set(),
      combinations: new Set()
    };
    
    // Process Artists
    if (response.artists && response.artists.length > 0) {
      response.artists.forEach(artist => {
        if (artist.name) tagCategories.artists.add(cleanDiscogsSuffix(artist.name));
      });
    }
    
    // Process individual track artists
    if (response.tracklist && response.tracklist.length > 0) {
      response.tracklist.forEach(track => {
        if (track.artists && track.artists.length > 0) {
          track.artists.forEach(artist => {
            if (artist.name) tagCategories.artists.add(cleanDiscogsSuffix(artist.name));
          });
        }
      });
    }
    
    // Process Album Info
    if (response.title) tagCategories.album.add(cleanDiscogsSuffix(response.title));
    if (response.released) {
      const year = response.released.substring(0, 4);
      tagCategories.album.add(year);
    }
    if (response.country) tagCategories.album.add(response.country);
    
    // Labels
    if (response.labels && response.labels.length > 0) {
      response.labels.forEach(label => {
        if (label.name) tagCategories.album.add(cleanDiscogsSuffix(label.name));
      });
    }
    
    // Genres & Styles
    if (response.genres && response.genres.length > 0) {
      response.genres.forEach(genre => tagCategories.album.add(genre));
    }
    if (response.styles && response.styles.length > 0) {
      response.styles.forEach(style => tagCategories.album.add(style));
    }
    
    // Process Tracklist
    if (response.tracklist && response.tracklist.length > 0) {
      response.tracklist.forEach(track => {
        if (track.title) tagCategories.tracklist.add(cleanDiscogsSuffix(track.title));
      });
    }
    
    // Generate Combinations
    if (response.title) {
      const cleanTitle = cleanDiscogsSuffix(response.title);
      
      // Artist + Album
      if (response.artists && response.artists.length > 0) {
        response.artists.forEach(artist => {
          if (artist.name) {
            tagCategories.combinations.add(`${cleanDiscogsSuffix(artist.name)} ${cleanTitle}`);
          }
        });
      }
      
      // Year + Album
      if (response.released) {
        const year = response.released.substring(0, 4);
        tagCategories.combinations.add(`${cleanTitle} ${year}`);
      }
      
      // Label + Album
      if (response.labels && response.labels.length > 0) {
        response.labels.forEach(label => {
          if (label.name) {
            tagCategories.combinations.add(`${cleanDiscogsSuffix(label.name)} ${cleanTitle}`);
          }
        });
      }
      
      // Genre/Style + Album
      if (response.genres && response.genres.length > 0) {
        response.genres.forEach(genre => {
          tagCategories.combinations.add(`${genre} ${cleanTitle}`);
        });
      }
      if (response.styles && response.styles.length > 0) {
        response.styles.forEach(style => {
          tagCategories.combinations.add(`${style} ${cleanTitle}`);
        });
      }
      
      // Artist + Year
      if (response.artists && response.artists.length > 0 && response.released) {
        const year = response.released.substring(0, 4);
        response.artists.forEach(artist => {
          if (artist.name) {
            tagCategories.combinations.add(`${cleanDiscogsSuffix(artist.name)} ${year}`);
          }
        });
      }
    }
    
    // Convert Sets to Arrays and update state
    const processedTags = {
      artists: Array.from(tagCategories.artists),
      album: Array.from(tagCategories.album),
      tracklist: Array.from(tagCategories.tracklist),
      combinations: Array.from(tagCategories.combinations)
    };
    
    setParsedTags(processedTags);
    
    // Update filter counts
    const newFilters = { ...tagFilters };
    Object.keys(processedTags).forEach(category => {
      newFilters[category].count = processedTags[category].length;
      newFilters[category].totalChars = processedTags[category].join(',').length;
    });
    setTagFilters(newFilters);
    
    // Generate initial tags value based on current filter settings
    generateTagsValue(processedTags, newFilters);
  };
  
  // Function to generate tags based on filters
  const generateTagsValue = (tags = parsedTags, filters = tagFilters) => {
    const selectedTags = [];
    
    Object.keys(tags).forEach(category => {
      if (filters[category].enabled) {
        const categoryTags = tags[category];
        // Calculate how many tags to include based on percentage
        const tagsToInclude = Math.ceil((categoryTags.length * filters[category].percentage) / 100);
        selectedTags.push(...categoryTags.slice(0, tagsToInclude));
      }
    });
    
    setTagsValue(selectedTags.join(','));
  };
  
  // Update tag filtering logic
  const handleTagFilterChange = (type, field, value) => {
    setTagFilters(prev => {
      const updated = {
        ...prev,
        [type]: {
          ...prev[type],
          [field]: value
        }
      };
      
      // If we're changing percentage, regenerate tags
      if (field === 'percentage' || field === 'enabled') {
        setTimeout(() => generateTagsValue(parsedTags, updated), 0);
      }
      
      return updated;
    });
  };
  
  // Update select all tags handler
  const handleSelectAllTags = (checked) => {
    setSelectAllTags(checked);
    setTagFilters(prev => {
      const newFilters = { ...prev };
      Object.keys(newFilters).forEach(key => {
        newFilters[key].enabled = checked;
      });
      
      // Regenerate tags based on new filter settings
      setTimeout(() => generateTagsValue(parsedTags, newFilters), 0);
      
      return newFilters;
    });
  };

  // Modify the existing URL submit handler to use cleanDiscogsSuffix where artist names are used
  const handleUrlSubmit = async (e) => {
    if (e) e.preventDefault();
    setDebugInfo(prev => ({
      ...prev,
      url: urlInput
    }));

    // Discogs URL logic
    const discogsInfo = parseDiscogsUrl(urlInput);
    if (discogsInfo) {
      const route = 'http://localhost:3030/discogsFetch';
      try {
        const res = await fetch(route, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discogsInfo)
        });
        const data = await res.json();
        setDiscogsResponse(data); // Save to state
        logDiscogsRequest({ route, payload: discogsInfo, response: data });
        
        // Process the response for tags
        processDiscogsResponseToTags(data);
        
        // If response has a tracklist, generate textarea output
        if (Array.isArray(data.tracklist) && data.tracklist.length > 0) {
          // Helper to clean Discogs entity names by removing (number) suffixes
          const cleanDiscogsSuffix = (name) => {
            if (!name) return '';
            return name.replace(/\s+\(\d+\)$/, '');
          };

          // Helper to parse duration string (mm:ss or hh:mm:ss) to seconds
          function parseDuration(str) {
            if (!str) return 0;
            const parts = str.split(':').map(Number);
            if (parts.length === 3) {
              return parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
              return parts[0] * 60 + parts[1];
            } else if (parts.length === 1) {
              return parts[0];
            }
            return 0;
          }
          // Store Discogs tracks and durations for dropdown reactivity
          discogsTracksRef.current = data.tracklist;
          discogsDurationsRef.current = data.tracklist.map(track => parseDuration(track.duration));
          audioFilesRef.current = [];
          durationsRef.current = [];
          setInputSource('discogs');
          // Enable artist dropdown if any track has an artist
          const hasArtist = data.tracklist.some(track => Array.isArray(track.artists) && track.artists.length > 0 && track.artists[0].name);
          setArtistDisabled(!hasArtist);
          // Build textarea output
          let currentTime = 0;
          // Helper: check if dash-artist dropdown is present and enabled
          const dashArtistIdx = formatOrder.findIndex(item => item.value === 'dash-artist');
          const dashArtistEnabled = dashArtistIdx !== -1 && hasArtist;
          const lines = data.tracklist.map((track, idx) => {
            const durationSec = discogsDurationsRef.current[idx] || 0;
            const start = formatTime(currentTime);
            const end = formatTime(currentTime + durationSec);
            currentTime += durationSec;
            
            // Get artist name for this track if present, and clean it
            let artistName = '';
            if (Array.isArray(track.artists) && track.artists.length > 0 && track.artists[0].name) {
              artistName = track.artists.map(a => cleanDiscogsSuffix(a.name)).join(', ');
            }
            
            return formatOrder
              .map(item => {
                if (item.value === 'blank') return '';
                if (item.value === 'startTime') return start;
                if (item.value === 'endTime') return end;
                if (item.value === 'title' ) return track.title || '';
                if (item.value === 'dash' ) return '-';
                if (item.value === 'dash-artist') return dashArtistEnabled ? '-' : '';
                if (item.value === 'artist') return artistName;
                return '';
              })
              .filter(Boolean)
              .join(' ');
          });
          setInputValue(lines.join('\n'));
        }
      } catch (err) {
        console.error('Error fetching Discogs data:', err);
        setDiscogsResponse(null);
        logDiscogsRequest({ route, payload: discogsInfo, response: String(err) });
      }
    }
  };

  // Method to print Discogs response
  const printDiscogsResponse = () => {
    if (discogsResponse) {
      console.log('Discogs API response:', discogsResponse);
    } else {
      console.log('No Discogs response available.');
    }
  };

  // Detect if anything has changed from defaults
  const isChanged =
    JSON.stringify(formatOrder) !== JSON.stringify(defaultFormatOrder) ||
    JSON.stringify(selectOptions) !== JSON.stringify(defaultSelectOptions) ||
    inputValue !== '' ||
    urlInput !== '' ||
    debugInfo.url !== '' ||
    (debugInfo.files && debugInfo.files.length > 0);

  // Reset everything to default
  const handleReset = () => {
    setFormatOrder(defaultFormatOrder);
    setSelectOptions(defaultSelectOptions);
    setInputValue('');
    setUrlInput('');
    setDebugInfo({ url: '', files: [] });
    setArtistDisabled(true);
    audioFilesRef.current = [];
    durationsRef.current = [];
    discogsTracksRef.current = [];
    discogsDurationsRef.current = [];
    setInputSource(null);
    setFormatSuggestion(null);
    // Reset tag-related state
    setTagsValue('');
    setParsedTags({
      artists: [],
      album: [],
      tracklist: [],
      combinations: []
    });
    setTagFilters({
      artists: { enabled: true, percentage: 100, count: 0, totalChars: 0 },
      album: { enabled: true, percentage: 100, count: 0, totalChars: 0 },
      tracklist: { enabled: true, percentage: 100, count: 0, totalChars: 0 },
      combinations: { enabled: true, percentage: 100, count: 0, totalChars: 0 }
    });
  };

  // Remove artist from placeholder lines
  const exampleLines = [
    '00:00 - 01:30 Title of the Track',
    '01:30 - 03:00 Another Track Title',
    '03:00 - 04:45 Yet Another Title',
    '04:45 - 06:00 Final Track Title'
  ];

  const getPlaceholder = () => {
    // Determine which example lines to show based on available tags
    const lines = exampleLines.filter(line => {
      const titlePart = line.replace(/^((\d{2}:\d{2}\s*(-\s*)?)+)?(\d{2}\s+)?-?\s*/i, '');
      const hasArtist = parsedTags.artists.length > 0;
      const hasAlbum = parsedTags.album.length > 0;
      const hasTracklist = parsedTags.tracklist.length > 0;
      const hasCombination = parsedTags.combinations.length > 0;
      
      // Show line if it has a title part and either:
      // - No tags are available, or
      // - It matches the available tag types (artist, album, tracklist, combination)
      return titlePart.trim() !== '' && (
        !hasArtist && !hasAlbum && !hasTracklist && !hasCombination ||
        (hasArtist && /Artist/.test(titlePart)) ||
        (hasAlbum && /Album/.test(titlePart)) ||
        (hasTracklist && /Track/.test(titlePart)) ||
        (hasCombination && /Combo/.test(titlePart))
      );
    });
    
    // If no lines match, fall back to a generic placeholder
    if (lines.length === 0) {
      return 'MM:SS - MM:SS Title of the Track';
    }
    
    // Return the first matching line as the placeholder
    return lines[0];
  };

  // Custom drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    
    // Create a properly styled drag image
    const originalElement = e.target;
    const dragImage = originalElement.cloneNode(true);
    
    // Apply the exact same styles to maintain size and appearance
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px'; // Move off-screen
    dragImage.style.left = '-1000px';
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'rotate(5deg)';
    dragImage.style.width = originalElement.offsetWidth + 'px';
    dragImage.style.height = originalElement.offsetHeight + 'px';
    dragImage.style.display = 'flex';
    dragImage.style.alignItems = 'stretch';
    dragImage.style.pointerEvents = 'none';
    dragImage.style.zIndex = '9999';
    
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
    
    // Clean up the drag image after a short delay
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
  };

  const handleDragEnd = (e) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e) => {
    // Only clear dragOverIndex if we're leaving the entire drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    console.log('Reordering from', draggedIndex, 'to', dropIndex);
    
    // Reorder both formatOrder and selectOptions
    const newFormatOrder = [...formatOrder];
    const newSelectOptions = [...selectOptions];
    
    const draggedItem = newFormatOrder[draggedIndex];
    const draggedOptions = newSelectOptions[draggedIndex];
    
    // Remove dragged item
    newFormatOrder.splice(draggedIndex, 1);
    newSelectOptions.splice(draggedIndex, 1);
    
    // Insert at new position
    newFormatOrder.splice(dropIndex, 0, draggedItem);
    newSelectOptions.splice(dropIndex, 0, draggedOptions);
    
    setFormatOrder(newFormatOrder);
    setSelectOptions(newSelectOptions);
    setDragOverIndex(null);
  };

  // At the start of your return statement:
  if (!hasHydrated || !isClient) {
    // Show a loading state or nothing until client-side hydration is complete
    return (
      <div>
        <div className={styles.taggerText} style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          <strong>Loading...</strong>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.taggerText} style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
        <strong>Input:</strong>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap'
        }}
      >
        <div
          style={{
            flex: '1 1 300px',
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <FileDrop onFilesSelected={handleFilesSelected} />
        </div>
        <div
          id='url-input-container'
          ref={urlInputContainerRef}
          style={{
            flex: '1 1 300px',
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            height: '100%',
            paddingTop: isStacked ? 0 : '1rem'
          }}
        >
          <form
            style={{
              marginBottom: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: 0,
              width: '100%' // Changed from 80% to 100%
            }}
            onSubmit={handleUrlSubmit}
          >
            <label
              htmlFor="url-input"
              className={styles.taggerText}
              style={{ marginBottom: 0, marginRight: '0.5rem' }}
            >
              URL:
            </label>
            <div style={{ display: 'flex', flex: 1, width: '100%' }}> {/* Added width: 100% */}
              <input
                id="url-input"
                type="text"
                placeholder="Paste a supported URL"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                style={{
                  padding: '0.5rem',
                  borderRadius: '4px 0 0 4px',
                  border: '1px solid #fafafa',
                  borderRight: 'none',
                  color: '#222',
                  background: '#fff',
                  flex: 1,
                  minWidth: 0,
                  width: '100%', // Changed from 0 to 100%
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleUrlSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0 4px 4px 0',
                  border: '1px solid #ccc',
                  borderLeft: 'none',
                  background: '#eee',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s, box-shadow 0.2s, color 0.2s',
                  width: 'auto', // Ensures button only as wide as content
                  flexShrink: 0 // Prevents button from shrinking
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#ffe156';
                  e.currentTarget.style.color = '#000';
                  e.currentTarget.style.boxShadow = '0 2px 8px #ffe15655';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#eee';
                  e.currentTarget.style.color = '#222';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                Submit
              </button>
            </div>
          </form>
          <div
            className={styles.taggerText}
            style={{
              marginBottom: '0.25rem',
              maxWidth: '100%',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
              fontSize: '0.95em'
            }}
          >
            <small>
              Supported URLs: Discogs, Bandcamp
            </small>
          </div>
        </div>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid black', height: '1px' }} />
      <div className={styles.taggerText} style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
        <strong>Timestamps:</strong>
      </div>
      
      <div
        style={{
          width: '100%',
          display: 'flex',
          gap: 0,
          justifyContent: 'center',
          alignItems: 'stretch',
          height: '2.5rem',
        }}
        className="timestamp-format-container"
      >
        {formatOrder.map((item, idx) => (
          <div
            key={`format-item-${item.id}`}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
            style={{
              display: 'flex',
              alignItems: 'stretch',
              flex: 1,
              minWidth: 0,
              opacity: draggedIndex === idx ? 0.3 : 1,
              backgroundColor: dragOverIndex === idx ? '#e3f2fd' : 'transparent',
              transform: draggedIndex === idx ? 'scale(1.02) rotate(2deg)' : 'none',
              transition: draggedIndex === idx ? 'none' : 'all 0.2s ease',
              cursor: draggedIndex === idx ? 'grabbing' : 'grab',
              zIndex: draggedIndex === idx ? 1000 : 1,
              border: dragOverIndex === idx ? '2px dashed #2196f3' : '2px solid transparent'
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 0,
                paddingLeft: 4,
                paddingRight: 4,
                background: draggedIndex === idx ? '#bbdefb' : '#fff',
                borderTopLeftRadius: idx === 0 ? 4 : 0,
                borderBottomLeftRadius: idx === 0 ? 4 : 0,
                borderTopRightRadius: 0,
                borderBottomRightRadius: 0,
                border: '1px solid #ccc',
                borderRight: 'none',
                cursor: draggedIndex === idx ? 'grabbing' : 'grab',
                userSelect: 'none',
                transition: 'background-color 0.2s',
                color: draggedIndex === idx ? '#1976d2' : '#666'
              }}
              onMouseDown={() => console.log('Drag handle clicked')}
            >
              <GripVertical size={18} />
            </span>
            <select
              className="taggerOptions"
              id={`taggerOption${item.id}`}
              value={item.value}
              onChange={e => handleSelectChange(idx, e.target.value)}
              disabled={
                (item.value === 'artist' && artistDisabled) ||
                (item.value === 'dash-artist' && artistDisabled)
              }
              style={{
                height: '100%',
                flex: 1,
                minWidth: 0,
                padding: 0,
                borderRadius: idx === 0
                  ? '0 0 0 0'
                  : idx === formatOrder.length - 1
                  ? '0 4px 4px 0'
                  : '0',
                border: '1px solid #ccc',
                borderLeft: 'none',
                borderRight: idx !== formatOrder.length - 1 ? 'none' : '1px solid #ccc',
                fontSize: '1rem',
                textAlign: 'center',
                background: draggedIndex === idx ? '#f5f5f5' : '#fff',
                boxSizing: 'border-box',
                cursor:
                  ((item.value === 'artist' && artistDisabled) ||
                    (item.value === 'dash-artist' && artistDisabled))
                    ? 'not-allowed'
                    : 'pointer',
                pointerEvents: draggedIndex === idx ? 'none' : 'auto'
              }}
            >
              {selectOptions[idx].map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div style={{ width: '100%' }}>
        <textarea
          value={inputValue ? `Timestamps generated by https://tagger.site:\n${inputValue}` : ''}
          onChange={e => {
            // Remove the prefix if present, then update inputValue
            const prefix = 'Timestamps generated by https://tagger.site:\n';
            let val = e.target.value;
            if (val.startsWith(prefix)) val = val.slice(prefix.length);
            setInputValue(val);
          }}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder={inputFocused ? '' : getPlaceholder()}
          rows={7}
          cols={44}
          style={{
            width: '100%',
            minWidth: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '1rem',
            boxSizing: 'border-box',
            display: 'block',
            resize: 'both'
          }}
        />
        <button
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: copyState === 'copied' ? '#ffe156' : '#eee',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '0.25rem',
            display: 'block',
            transition: 'background 0.2s, box-shadow 0.2s, color 0.2s',
            ...(copyState === 'hover'
              ? { background: '#ffe156', color: '#222', boxShadow: '0 2px 8px #ffe15655' }
              : {})
          }}
          onClick={handleCopy}
          onMouseEnter={() => setCopyState(copyState === 'copied' ? 'copied' : 'hover')}
          onMouseLeave={() => setCopyState(copyState === 'copied' ? 'copied' : 'idle')}
        >
          {copyState === 'copied'
            ? 'Copied!'
            : `Copy ${(inputValue ? (`Timestamps generated by https://tagger.site:\n${inputValue}`) : '').length} chars to clipboard`}
        </button>
        {/* Formatting Suggestion Popup */}
        {formatSuggestion && (
          <div
            style={{
              marginTop: '1rem',
              background: '#fffbe6',
              border: '1px solid #ffe156',
              borderRadius: 6,
              padding: '1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              maxWidth: 600,
              position: 'relative'
            }}
          >
            {/* X button */}
            <button
              onClick={() => setFormatSuggestion(null)}
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                color: '#d97706',
                cursor: 'pointer',
                padding: 0,
                lineHeight: 1,
                transition: 'color 0.2s'
              }}
              aria-label="Close formatting suggestion"
              onMouseEnter={e => { e.currentTarget.style.color = '#b45309'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#d97706'; }}
            >
              ×
            </button>
            <button
              onClick={applyFormatSuggestion}
              style={{
                background: '#ffe156',
                color: '#222',
                border: 'none',
                borderRadius: 4,
                padding: '0.5rem 1.2rem',
                fontWeight: 700,
                fontSize: '1em',
                cursor: 'pointer',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                marginBottom: 12,
                display: 'block',
                transition: 'background 0.2s, box-shadow 0.2s, color 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ffd700';
                e.currentTarget.style.color = '#000';
                e.currentTarget.style.boxShadow = '0 2px 8px #ffd70055';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#ffe156';
                e.currentTarget.style.color = '#222';
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
              }}
            >
              Click to remove duplicate text: "{formatSuggestion.prefix}"
            </button>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              Formatting Suggestion: Remove duplicate text <span style={{ color: '#d97706' }}>"{formatSuggestion.prefix}"</span>
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95em', color: '#888', marginBottom: 2 }}>Before:</div>
                <pre style={{
                  background: '#f6f6f6',
                  border: '1px solid #eee',
                  borderRadius: 4,
                  padding: 8,
                  margin: 0,
                  fontSize: '0.98em',
                  whiteSpace: 'pre-wrap'
                }}>{formatSuggestion.before}</pre>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.95em', color: '#888', marginBottom: 2 }}>After:</div>
                <pre style={{
                  background: '#f6f6f6',
                  border: '1px solid #eee',
                  borderRadius: 4,
                  padding: 8,
                  margin: 0,
                  fontSize: '0.98em',
                  whiteSpace: 'pre-wrap'
                }}>{formatSuggestion.after}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Loading Spinner Overlay */}
      {isLoadingFiles && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(255,255,255,0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            border: '6px solid #eee',
            borderTop: '6px solid #6366f1',
            borderRadius: '50%',
            width: 60,
            height: 60,
            animation: 'spin 1s linear infinite',
          }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {/* Clear/Reset Button moved here above Debug Box */}
      {isChanged && (
        <button
          type="button"
          onClick={handleReset}
          style={{
            margin: '1rem 0 1rem 0',
            background: '#f6f6f6',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '0.5rem 1.2rem',
            fontWeight: 600,
            fontSize: '1em',
            cursor: 'pointer',
            color: '#222',
            display: 'block',
            width: '100%',
            transition: 'background 0.2s, box-shadow 0.2s, color 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#ffe156';
            e.currentTarget.style.color = '#000';
            e.currentTarget.style.boxShadow = '0 2px 8px #ffe15655';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#f6f6f6';
            e.currentTarget.style.color = '#222';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Clear / Reset
        </button>
      )}
      {/* --- New Section Below --- */}
      <hr style={{ border: 'none', borderTop: '1px solid black', height: '1px' }} />
      <div className={styles.taggerText} style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
        <strong>Tags:</strong>
      </div>
      <textarea
        value={tagsValue}
        onChange={e => setTagsValue(e.target.value)}
        placeholder="Booker T. Jones,Priscilla Jones,Booker T & The MGs,The Mar-Keys,The Stax Staff,The Packers,The RCO All-Stars,Priscilla Coolidge,Booker T. & Priscilla,1971,France,The Wedding Song,She,The Indian Song,Sea Gull,For Priscilla,The Delta Song,Why,Mississippi Voodoo,Cool Black Dream,Sweet Child Youre Not Alone,Booker T. & Priscilla 1971,Booker T. Jones 1971,"
        rows={7}
        cols={44}
        style={{
          width: '100%',
          minWidth: '100%',
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #ccc',
          fontSize: '1rem',
          boxSizing: 'border-box',
          display: 'block',
          resize: 'none',
          marginBottom: '1rem'
        }}
      />
      
      {/* Tags Filter Table */}
      <table style={{
        width: '100%',
        whiteSpace: 'nowrap',
        tableLayout: 'fixed',
        borderCollapse: 'collapse',
        border: '1px solid #ccc',
        marginBottom: '1rem',
        background: '#ffffff'
      }}>
        <tbody>
          {/* Header */}
          <tr style={{ backgroundColor: '#ffffff', border: '1px solid #ccc' }}>
            <th style={{ textAlign: 'center', width: '6%', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="checkbox" 
                checked={selectAllTags}
                onChange={e => handleSelectAllTags(e.target.checked)}
              />
            </th>
            <th style={{ textAlign: 'center', width: '14%', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              Tags Type
            </th>
            <th style={{ textAlign: 'center', width: '20%', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              Tags
            </th>
          </tr>

          {/* Artists */}
          <tr style={{ background: '#ffffff' }}>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="checkbox" 
                checked={tagFilters.artists.enabled}
                onChange={e => handleTagFilterChange('artists', 'enabled', e.target.checked)}
              />
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              Artist(s)
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={tagFilters.artists.percentage}
                onChange={e => handleTagFilterChange('artists', 'percentage', parseInt(e.target.value))}
                style={{ marginRight: '0.5rem' }}
              />
              <span>{tagFilters.artists.percentage}%</span>
              <div style={{ fontSize: '15px', marginTop: '0.25rem' }}>
                <div>{Math.round((parsedTags.artists.join(',').length * tagFilters.artists.percentage) / 100)} chars</div>
                <div>{Math.ceil((parsedTags.artists.length * tagFilters.artists.percentage) / 100)}/{parsedTags.artists.length} tags</div>
              </div>
            </td>
          </tr>

          {/* Album */}
          <tr style={{ background: '#ffffff' }}>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="checkbox" 
                checked={tagFilters.album.enabled}
                onChange={e => handleTagFilterChange('album', 'enabled', e.target.checked)}
              />
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              Album
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={tagFilters.album.percentage}
                onChange={e => handleTagFilterChange('album', 'percentage', parseInt(e.target.value))}
                style={{ marginRight: '0.5rem' }}
              />
              <span>{tagFilters.album.percentage}%</span>
              <div style={{ fontSize: '15px', marginTop: '0.25rem' }}>
                <div>{Math.round((parsedTags.album.join(',').length * tagFilters.album.percentage) / 100)} chars</div>
                <div>{Math.ceil((parsedTags.album.length * tagFilters.album.percentage) / 100)}/{parsedTags.album.length} tags</div>
              </div>
            </td>
          </tr>

          {/* Tracklist */}
          <tr style={{ background: '#ffffff' }}>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="checkbox" 
                checked={tagFilters.tracklist.enabled}
                onChange={e => handleTagFilterChange('tracklist', 'enabled', e.target.checked)}
              />
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              Tracklist
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={tagFilters.tracklist.percentage}
                onChange={e => handleTagFilterChange('tracklist', 'percentage', parseInt(e.target.value))}
                style={{ marginRight: '0.5rem' }}
              />
              <span>{tagFilters.tracklist.percentage}%</span>
              <div style={{ fontSize: '15px', marginTop: '0.25rem' }}>
                <div>{Math.round((parsedTags.tracklist.join(',').length * tagFilters.tracklist.percentage) / 100)} chars</div>
                <div>{Math.ceil((parsedTags.tracklist.length * tagFilters.tracklist.percentage) / 100)}/{parsedTags.tracklist.length} tags</div>
              </div>
            </td>
          </tr>

          {/* Combinations */}
          <tr style={{ background: '#ffffff' }}>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="checkbox" 
                checked={tagFilters.combinations.enabled}
                onChange={e => handleTagFilterChange('combinations', 'enabled', e.target.checked)}
              />
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              Combinations
            </td>
            <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #ccc', background: '#ffffff' }}>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={tagFilters.combinations.percentage}
                onChange={e => handleTagFilterChange('combinations', 'percentage', parseInt(e.target.value))}
                style={{ marginRight: '0.5rem' }}
              />
              <span>{tagFilters.combinations.percentage}%</span>
              <div style={{ fontSize: '15px', marginTop: '0.25rem' }}>
                <div>{Math.round((parsedTags.combinations.join(',').length * tagFilters.combinations.percentage) / 100)} chars</div>
                <div>{Math.ceil((parsedTags.combinations.length * tagFilters.combinations.percentage) / 100)}/{parsedTags.combinations.length} tags</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      
      {/* Tags Copy Button */}
      <button
        style={{
          width: '100%',
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #ccc',
          background: tagsCopyState === 'copied' ? '#ffe156' : '#eee',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '0.5rem', // Changed from 1rem to 0.5rem to reduce space before optimization UI
          display: 'block',
          transition: 'background 0.2s, box-shadow 0.2s, color 0.2s',
          ...(tagsCopyState === 'hover'
            ? { background: '#ffe156', color: '#222', boxShadow: '0 2px 8px #ffe15655' }
            : {})
        }}
        onClick={handleTagsCopy}
        onMouseEnter={() => setTagsCopyState(tagsCopyState === 'copied' ? 'copied' : 'hover')}
        onMouseLeave={() => setTagsCopyState(tagsCopyState === 'copied' ? 'copied' : 'idle')}
      >
        {tagsCopyState === 'copied'
          ? 'Copied!'
          : `Copy ${tagsValue.length} chars to clipboard`}
      </button>
      
      {/* Tags Optimization UI - ADD THIS SECTION */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        marginBottom: '0.5rem',
        gap: '0.5rem'
      }}>
        <input
          type="number"
          value={charLimit}
          onChange={(e) => setCharLimit(e.target.value)}
          placeholder="Char limit"
          style={{
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            width: '100px'
          }}
          min="1"
          max="5000"
        />
        <button
          onClick={optimizeTags}
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ccc',
            background: '#eee',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background 0.2s, box-shadow 0.2s, color 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#ffe156';
            e.currentTarget.style.color = '#000';
            e.currentTarget.style.boxShadow = '0 2px 8px #ffe15655';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#eee';
            e.currentTarget.style.color = '#222';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Optimize Tags to Character Limit
        </button>
      </div>
      
      {/* Optimization status message */}
      {optimizeStatus && (
        <div style={{ 
          marginBottom: '1rem',
          padding: '0.5rem',
          fontSize: '0.9rem',
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '4px',
          color: '#0369a1'
        }}>
          {optimizeStatus}
        </div>
      )}
    </div>
  );
}