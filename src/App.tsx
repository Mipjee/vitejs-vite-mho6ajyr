import React, { useState, useEffect } from 'react';

interface User {
  username: string;
  bio: string;
  post_karma: number;
  icon_img?: string;
}

interface Comment {
  author: string;
  body: string;
}

function App() {
  const [subreddit, setSubreddit] = useState('');
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [comments, setComments] = useState<Map<string, Comment[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSubredditData = async (subredditName: string) => {
    setLoading(true);
    setError('');
    try {
      // Controleer eerst of de subreddit bestaat
      const checkResponse = await fetch(`https://www.reddit.com/r/${subredditName}/about.json`);
      if (!checkResponse.ok) {
        throw new Error('Subreddit niet gevonden');
      }

      // Haal recente posts op met meer error handling
      const response = await fetch(`https://www.reddit.com/r/${subredditName}/new.json?limit=10`);
      if (!response.ok) {
        throw new Error('Kon geen posts ophalen');
      }
      
      const data = await response.json();
      if (!data.data?.children) {
        throw new Error('Ongeldige data ontvangen van Reddit');
      }
      
      const newUsers = new Map<string, User>();
      const newComments = new Map<string, Comment[]>();

      // Verwerk elke post
      for (const post of data.data.children) {
        try {
          const commentsResponse = await fetch(
            `https://www.reddit.com/r/${subredditName}/comments/${post.data.id}.json`
          );
          if (!commentsResponse.ok) continue;
          
          const commentsData = await commentsResponse.json();
          if (!commentsData[1]?.data?.children) continue;

          // Verwerk comments
          for (const comment of commentsData[1].data.children) {
            const author = comment.data?.author;
            if (
              author && 
              author !== '[deleted]' && 
              author !== 'AutoModerator' && 
              !newUsers.has(author)
            ) {
              try {
                const userResponse = await fetch(`https://www.reddit.com/user/${author}/about.json`);
                if (!userResponse.ok) continue;
                
                const userData = await userResponse.json();
                
                newUsers.set(author, {
                  username: author,
                  bio: userData.data?.subreddit?.description || 'Geen bio beschikbaar',
                  post_karma: userData.data?.link_karma || 0,
                  icon_img: userData.data?.icon_img
                });

                newComments.set(author, [
                  ...(newComments.get(author) || []),
                  { 
                    author, 
                    body: comment.data.body || 'Geen comment tekst beschikbaar'
                  }
                ]);
              } catch (userError) {
                console.warn(`Kon gebruikersdata niet ophalen voor ${author}:`, userError);
              }
            }
          }
        } catch (postError) {
          console.warn('Fout bij het verwerken van een post:', postError);
          continue;
        }
      }

      if (newUsers.size === 0) {
        setError('Geen gebruikers gevonden in deze subreddit');
      } else {
        setUsers(newUsers);
        setComments(newComments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is een onbekende fout opgetreden');
      console.error('Fout bij het ophalen van subreddit data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Reddit Subreddit Analyzer</h1>
      
      <div className="search-box">
        <input
          type="text"
          value={subreddit}
          onChange={(e) => setSubreddit(e.target.value)}
          placeholder="Voer een subreddit naam in"
        />
        <button 
          onClick={() => fetchSubredditData(subreddit)}
          disabled={loading || !subreddit}
        >
          Analyseer
        </button>
      </div>

      {loading && <p>Laden...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && users.size > 0 && (
        <table>
          <thead>
            <tr>
              <th>Gebruiker</th>
              <th>Comments</th>
              <th>Bio</th>
              <th>Post Karma</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(users.entries()).map(([username, user]) => (
              <tr key={username}>
                <td>{username}</td>
                <td>
                  <ul>
                    {comments.get(username)?.map((comment, idx) => (
                      <li key={idx}>{comment.body}</li>
                    ))}
                  </ul>
                </td>
                <td>{user.bio}</td>
                <td>{user.post_karma}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default App;