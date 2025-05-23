import React, { useState, useEffect } from 'react';
import { Helmet } from "react-helmet";
import { useLocation } from 'react-router-dom';
import styles from './JermaSearch.module.css'; 

const apiUrl = window.location.hostname === 'localhost' ? 'http://localhost:3030' : 'https://jermasearch.com/internal-api';

const JermaSearch = () => {
    const [results, setResults] = useState([]);
    const [totalResults, setTotalResults] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [expanded, setExpanded] = useState({});
    const [error, setError] = useState("");
    const [searchPage, setSearchPage] = useState(0); // State to track the current search page
    const [sortOrder, setSortOrder] = useState("mostRecent"); // State to track the sorting order
    const [searchPerformed, setSearchPerformed] = useState(false); // State to track if a search has been performed
    const [activeSection, setActiveSection] = useState("search"); // State to track the active section
    const [body, setBody] = useState("");  // State to track the body of the feedback
    const [email, setEmail] = useState("");  // State to track the email of the feedback
    const [feedbackResponse, setFeedbackResponse] = useState(""); // State to track feedback response

    const location = useLocation();

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const query = params.get('query');
        if (query) {
            setSearchTerm(query);
            handleSearch(null, 0, query);
        }
    }, [location]);

    const handleToggle = (index) => {
        setExpanded(prevState => ({
            ...prevState,
            [index]: !prevState[index]
        }));
    };

    const sortResults = (results, order) => {
        return results.sort((a, b) => {
            const dateA = new Date(a._source.upload_date.slice(0, 4), a._source.upload_date.slice(4, 6) - 1, a._source.upload_date.slice(6, 8));
            const dateB = new Date(b._source.upload_date.slice(0, 4), b._source.upload_date.slice(4, 6) - 1, b._source.upload_date.slice(6, 8));
            return order === "mostRecent" ? dateB - dateA : dateA - dateB;
        });
    };

    const handleSearch = async (e, page = 0, term = searchTerm) => {
        if (e) e.preventDefault();
        if (!term.trim()) {
            setError("Search term cannot be empty");
            return;
        }
        setSearchPerformed(true);
        setError(""); // Clear any previous error
        try {
            const response = await fetch(`${apiUrl}/algolia/search/${page}/${term}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            } else {
                const result = await response.json();
                console.log('backend response: ', response);
                console.log('raw: ', result.rawResponse);
    
                var hits = result.hits;
                console.log('hits: ', hits);
                var numberHits = result.numberHits;
                var currentPage = result.currentPage;
                var numberPages = result.numberPages;
                setTotalResults(numberHits);
    
                // Ensure the data has upload_date
                const validatedHits = hits.map(hit => {
                    console.log("hit = ", hit)
                    if (!hit._source.upload_date) {
                        console.error("Missing upload_date:", hit);
                        hit._source.upload_date = "Invalid Date";
                    }
                    return hit;
                });
    
                const sortedResults = sortResults(page === 0 ? validatedHits : [...results, ...validatedHits], sortOrder);
                setResults(sortedResults);
                setError('');
            }
        } catch (error) {
            setError(error.message);
            if (page === 0) setResults([]);
        }
    };

    const handleShowMore = () => {
        const nextPage = searchPage + 1;
        setSearchPage(nextPage);
        handleSearch(null, nextPage);
    };

    const handleSortChange = (e) => {
        setSortOrder(e.target.value);
        const sortedResults = sortResults(results, e.target.value);
        setResults(sortedResults);
    };

    const handleClear = () => {
        setResults([]);
        setTotalResults("");
        setSearchTerm("");
        setExpanded({});
        setError("");
        setSearchPerformed(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${apiUrl}/emailContactFormSubmission`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ body, email }),
            });
            if (response.ok) {
                setFeedbackResponse("Feedback submitted successfully");
                setBody("");
                setEmail("");
            } else {
                setFeedbackResponse("Error submitting feedback");
            }
        } catch (error) {
            setFeedbackResponse("Error submitting feedback: " + error.message);
        }
    };

    const formatDate = (dateString) => {
        console.log(`formatDate(${dateString})`)
        if (!dateString || dateString.length !== 8) {
            console.error("Invalid dateString:", dateString);
            return "Invalid Date";
        }
        const date = new Date(dateString.slice(0, 4), dateString.slice(4, 6) - 1, dateString.slice(6, 8));
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const formatStartTime = (start) => {
        if (isNaN(start) || start === null || start === undefined) {
            console.error("Invalid start time:", start);
            return "Invalid Time";
        }
        const date = new Date(start * 1000);
        return date.toISOString().substr(11, 8);
    };

    return (
        <div className={styles.jermaSearchContainer}>
            <Helmet>
                <html className={styles.jermaSearchHtml} />
                <body className={styles.jermaSearchBody} />
                <meta name="google-site-verification" content="8pFA2UWTUXgl_iMCwStnmG332el6U4vIeyyMEGcmG_g" />
                <meta charSet="utf-8" />
                <title>Jerma Search</title>
                <link rel="canonical" href="https://jermasearch.com/" />
                <meta name="description" content="Search through every Jerma985 stream." />
                <meta name="keywords" content="Jerma, Jerma985, Jerma search, Jerma stream search, search, logs, stream logs, transcript, subtitles" />
                <meta property="og:title" content="Jerma Search" />
                <meta property="og:description" content="A log of what Jerma has said in chat." />
                <meta property="og:type" content="website" />
                <meta property="og:url" content="https://jermasearch.com/" />
                <link rel="icon" href="../../ico/jermasearch.ico" />
                <meta property="og:image" content="../../.ico/jermasearch.ico" />
                <script type="application/ld+json">
                    {`
                        {
                            "@context": "https://schema.org",
                            "@type": "WebSite",
                            "url": "https://jermasearch.com/",
                            "name": "Jerma Search",
                            "description": "Search through text of every Jerma985 stream.",
                            "potentialAction": {
                                "@type": "SearchAction",
                                "target": {
                                    "@type": "EntryPoint",
                                    "urlTemplate": "https://jermasearch.com/jermasearch/search?query={search_term_string}"
                                },
                                "query-input": "required name=search_term_string"
                            }
                        }
                    `}
                </script>
                <script type="application/ld+json">
                    {`
                        {
                            "@context": "https://schema.org",
                            "@type": "BreadcrumbList",
                            "itemListElement": [
                                {
                                    "@type": "ListItem",
                                    "position": 1,
                                    "name": "Home",
                                    "item": "https://jermasearch.com/"
                                },
                                {
                                    "@type": "ListItem",
                                    "position": 2,
                                    "name": "Search",
                                    "item": "https://jermasearch.com/jermasearch/search?query=otto"
                                }
                            ]
                        }
                    `}
                </script>
                <script type="application/ld+json">
                    {`
                        {
                            "@context": "https://schema.org",
                            "@type": "WebPage",
                            "url": "https://jermasearch.com/",
                            "name": "Jerma Search",
                            "description": "Search through text of every Jerma985 stream.",
                            "breadcrumb": {
                                "@type": "BreadcrumbList",
                                "itemListElement": [
                                    {
                                        "@type": "ListItem",
                                        "position": 1,
                                        "name": "Home",
                                        "item": "https://jermasearch.com/"
                                    },
                                    {
                                        "@type": "ListItem",
                                        "position": 2,
                                        "name": "Search",
                                        "item": "https://jermasearch.com/jermasearch/search?query=jerma"
                                    }
                                ]
                            }
                        }
                    `}
                </script>
            </Helmet>

            <div className={styles.jermaSearchBody}>
                <section className={styles.searchContainer}>
                    <nav className={styles.topLinks}>
                        <button onClick={() => setActiveSection("search")}>Search</button>
                        <button onClick={() => setActiveSection("about")}>About</button>
                        <button onClick={() => setActiveSection("feedback")}>Feedback</button>
                    </nav>
                    {activeSection === "search" && (
                        <div className={styles.searchContent}>
                            <h1 className={styles.header}>
                                Jerma985 Search
                            </h1>
                            {error && <h1 className={styles.error}>{error}</h1>}

                            <form onSubmit={(e) => { setSearchPage(0); handleSearch(e, 0); }}>
                                <div className={styles.formControls}>
                                    <input
                                        id="searchQuote"
                                        type="text"
                                        placeholder="Search quote:"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className={styles.input}
                                    />
                                    <button type="submit" className={styles.button}>Submit</button>
                                    {searchPerformed && (
                                        <button type="button" onClick={handleClear} className={`${styles.button} ${styles.clearButton}`}>
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </form>

                            <div className={styles.resultsCount}>
                                {totalResults !== 0 ? `Found ${totalResults} results:` : ""}
                            </div>

                            <div className={styles.sortOptions}>
                                <label>Sort by: </label>
                                <select value={sortOrder} onChange={handleSortChange} className={styles.select}>
                                    <option value="mostRecent">Most Recent</option>
                                    <option value="furthestAway">Furthest Away</option>
                                </select>
                            </div>

                            <div className={styles.searchResults}>
                                {Array.isArray(results) && results.length > 0 ? (
                                    results.map((todoItem, index) => {
                                        const youtubeUrl = `https://www.youtube.com/watch?v=${todoItem._source.video_id}&t=${todoItem._source.start}s`;
                                        const embedUrl = `https://www.youtube.com/embed/${todoItem._source.video_id}?start=${todoItem._source.start}`;
                                        const thumbnailUrl = `https://img.youtube.com/vi/${todoItem._source.video_id}/0.jpg`;

                                        return (
                                            <div key={index} className={styles.resultItem}>
                                                <div className={styles.thumbnail}>
                                                    <img src={thumbnailUrl} alt="video thumbnail" />
                                                </div>
                                                <div className={styles.quoteInfo}>
                                                    <p><strong>Quote:</strong> {todoItem._source.quote}</p>
                                                    <p><strong>Start:</strong> {formatStartTime(todoItem._source.start)}</p>
                                                    <p><strong>Upload Date:</strong> {formatDate(todoItem._source.upload_date)}</p>
                                                    <p><strong>Video:</strong> <a href={youtubeUrl} target="_blank" rel="noopener noreferrer">{todoItem._source.video_title}</a></p>
                                                    <button onClick={() => handleToggle(index)} className={styles.button}>
                                                        {expanded[index] ? '▼ Hide quote in video' : '▶ View quote in video'}
                                                    </button>
                                                    {expanded[index] && (
                                                        <div className={styles.videoEmbed}>
                                                            <iframe
                                                                width="560"
                                                                height="350" // Updated height
                                                                src={embedUrl}
                                                                title="YouTube video player"
                                                                frameBorder="0"
                                                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                                allowFullScreen
                                                            ></iframe>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    searchPerformed && <div>No results found</div>
                                )}
                            </div>

                            {Array.isArray(results) && results.length > 0 && totalResults >= 100 && (
                                <div className={styles.pagination}>
                                    <button onClick={handleShowMore} className={styles.button}>Load More Results</button>
                                </div>
                            )}
                        </div>
                    )}
                    {activeSection === "about" && (
                        <div className={styles.aboutContent}>
                            <h1>About</h1>
                            <p>This website allows users to search through every known livestream from entertainer <a href="https://www.youtube.com/channel/UCL7DDQWP6x7wy0O6L5ZIgxg">Jerma985</a>.
                                <br /><br />
                                Every livestream from 2012 to the present in <a href="https://www.youtube.com/playlist?list=PLd4kmFVnghOiWHL8EStIzMXwySWm-7K1f">this playlist</a> of Jerma's streams was downloaded and converted to an audio file using <a href="https://github.com/yt-dlp/yt-dlp">yt-dlp</a>. That audio file was converted to a timestamped subtitle file (.srt) using <a href="https://github.com/openai/whisper">Whisper transcription with Python by OpenAI</a>.
                                <br /><br />
                                The subtitle files are then uploaded to an database for each quote. The database is connected to this React web app, allowing users to search through thousands of Jerma's iconic streams and find whatever quote they're looking for. All code for this project is open-source and available on <a href="https://github.com/MartinBarker/aws-react-docker-ghactions">GitHub</a>.
                                <br /><br />
                                Note: Since the audio from these streams is transcribed using AI, it's possible that some quotes are not 100% accurate. Some words, such as "Jerma," get autocorrected by the AI to be "Germa," for example. If you find any incorrect quotes, please send them to me via the "Feedback" tab at the top of this page.
                                <br /><br />
                                Thanks! - Martin</p>
                        </div>
                    )}
                    {activeSection === "feedback" && (
                        <div className={styles.feedbackContent}>
                            <h1>Feedback</h1>
                            <p>If you have any feedback on this website, or would like to report an inaccurately transcribed quote, please <a href="mailto:martinbarker99@gmail.com">send me an email</a> or use the form below : )</p>
                            <form className={styles.contactForm} onSubmit={handleSubmit}>
                                <label>
                                    Body:
                                    <textarea
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        required
                                        className={styles.bodyTextarea}
                                    />
                                </label>
                                <label>
                                    Email:
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className={styles.emailInput}
                                    />
                                </label>
                                <button type="submit" className={styles.button}>Submit</button>
                            </form>
                            {feedbackResponse && <p>{feedbackResponse}</p>}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}

export default JermaSearch;
