import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// --- Helper Components ---
const Loader = () => (
  <div className="flex justify-center items-center p-8">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-500"></div>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative my-4" role="alert">
    <strong className="font-bold">Error: </strong>
    <span className="block sm:inline">{message}</span>
  </div>
);

const StatCard = ({ label, value }) => (
  <div className="bg-gray-800 p-4 rounded-lg text-center shadow-md">
    <p className="text-sm text-gray-400">{label}</p>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

// --- Profile Page Component ---
const ProfilePage = () => {
  const { username: urlUsername } = useParams();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const userToFetch = urlUsername || 'DrNykterstein';
    
    const fetchUserData = async () => {
      setLoading(true);
      setError(null);
      setUserData(null);

      try {
        const response = await fetch(`https://lichess.org/api/user/${userToFetch}`);
        
        // This is the error handling logic
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('User not found. Please check the username and try again.');
          }
          throw new Error('Something went wrong fetching the user data.');
        }

        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
    setSearchInput(userToFetch);
  }, [urlUsername]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchInput) {
      navigate(`/profile/${searchInput}`);
    }
  };

  const getRating = (perf) => perf ? perf.rating : 'N/A';

  return (
    <div className="animate-fade-in">
      <h2 className="text-3xl font-bold mb-6 text-center text-white">Find a Lichess User</h2>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-8 max-w-lg mx-auto">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Enter Lichess username"
          className="flex-grow bg-gray-800 text-white placeholder-gray-500 border border-gray-700 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
        />
        <button type="submit" className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-6 rounded-md transition duration-300 shadow-lg">
          Search
        </button>
      </form>

      {loading && <Loader />}
      {error && <ErrorMessage message={error} />}
      
      {userData && (
        <div className="bg-gray-900 shadow-2xl rounded-xl p-6 max-w-2xl mx-auto animate-fade-in-up">
            {/* User data rendering remains the same */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="flex-shrink-0 relative">
                    <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center text-4xl font-bold text-teal-400 border-4 border-gray-700">
                        {userData.username.charAt(0).toUpperCase()}
                    </div>
                    <span 
                        className={`absolute bottom-1 right-1 block h-5 w-5 rounded-full border-2 border-gray-900 ${userData.online ? 'bg-green-500' : 'bg-gray-600'}`}
                        title={userData.online ? 'Online' : 'Offline'}
                    ></span>
                </div>
                <div className="text-center sm:text-left">
                    <h3 className="text-3xl font-bold text-white">{userData.username} {userData.title && <span className="text-yellow-400 text-xl align-middle">{userData.title}</span>}</h3>
                    {userData.profile?.firstName && userData.profile?.lastName && (
                        <p className="text-gray-400">{userData.profile.firstName} {userData.profile.lastName}</p>
                    )}
                    {userData.profile?.bio && (
                        <p className="text-gray-300 mt-2 italic">"{userData.profile.bio}"</p>
                    )}
                </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Games" value={userData.count?.all.toLocaleString() || 0} />
                <StatCard label="Wins" value={userData.count?.win.toLocaleString() || 0} />
                <StatCard label="Losses" value={userData.count?.loss.toLocaleString() || 0} />
                <StatCard label="Draws" value={userData.count?.draw.toLocaleString() || 0} />
            </div>

            <div className="mt-6">
                <h4 className="text-xl font-semibold mb-3 text-white">Ratings</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Bullet" value={getRating(userData.perfs?.bullet)} />
                    <StatCard label="Blitz" value={getRating(userData.perfs?.blitz)} />
                    <StatCard label="Rapid" value={getRating(userData.perfs?.rapid)} />
                    <StatCard label="Classical" value={getRating(userData.perfs?.classical)} />
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

