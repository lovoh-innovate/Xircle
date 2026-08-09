// src/workspaceScreens/MyWorkspaceUpdateProject.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useGetProjectByIdQuery, useUpdateProjectMutation } from '../slices/projectApiSlice';
import MyWorkspaceSidebar from '../workspaceComponents/MyWorkspaceSidebar';
import MyWorkspaceBottombar from '../workspaceComponents/MyWorkspaceBottombar';
import {
  FaArrowLeft,
  FaSave,
  FaTimes,
  FaPlus,
  FaTrashAlt,
  FaLink,
  FaFileAlt,
  FaInfoCircle,
  FaTag,
  FaClock,
  FaImage,
  FaListUl,
  FaListOl,
  FaBold,
  FaItalic,
  FaUnderline,
  FaQuoteRight,
} from 'react-icons/fa';
import { toast } from 'react--hot-toast';

// ─── Rich Text Toolbar ──────────────────────────────────────────────
const RichTextToolbar = ({ onFormat, brandColor }) => {
  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-gray-100 dark:bg-[#1a1a24] border-b border-gray-200 dark:border-gray-800/60 rounded-t-xl flex-wrap">
      <button
        type="button"
        onClick={() => onFormat('bold')}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800/60 rounded text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs font-bold transition"
        title="Bold"
      >
        <FaBold className="text-xs" />
      </button>
      <button
        type="button"
        onClick={() => onFormat('italic')}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800/60 rounded text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs italic transition"
        title="Italic"
      >
        <FaItalic className="text-xs" />
      </button>
      <button
        type="button"
        onClick={() => onFormat('underline')}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800/60 rounded text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs underline transition"
        title="Underline"
      >
        <FaUnderline className="text-xs" />
      </button>
      <span className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <button
        type="button"
        onClick={() => onFormat('bullet')}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800/60 rounded text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs transition"
        title="Bullet List"
      >
        <FaListUl className="text-xs" />
      </button>
      <button
        type="button"
        onClick={() => onFormat('number')}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800/60 rounded text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs transition"
        title="Numbered List"
      >
        <FaListOl className="text-xs" />
      </button>
      <span className="w-px h-5 bg-gray-300 dark:bg-gray-700 mx-1" />
      <button
        type="button"
        onClick={() => onFormat('quote')}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800/60 rounded text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white text-xs transition"
        title="Quote"
      >
        <FaQuoteRight className="text-xs" />
      </button>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────
const MyWorkspaceUpdateProject = () => {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const { data: workspaceData, isLoading: workspaceLoading } = useGetWorkspaceQuery(workspaceId);
  const { data: projectData, isLoading: projectLoading } = useGetProjectByIdQuery(projectId);
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();

  // ── Form state ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [projectType, setProjectType] = useState('general');
  const [dailyReportTime, setDailyReportTime] = useState('17:00');
  const [links, setLinks] = useState('');
  const [documents, setDocuments] = useState([]);
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [existingCoverImage, setExistingCoverImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (projectData?.project) {
      const p = projectData.project;
      setName(p.name || '');
      setDescription(p.description || '');
      setDetailedDescription(p.detailedDescription || '');
      setPriority(p.priority || 'medium');
      setProjectType(p.projectType || 'general');
      setDailyReportTime(p.dailyReportTime || '17:00');
      if (p.links && Array.isArray(p.links)) {
        setLinks(p.links.join('\n'));
      }
      setExistingDocuments(p.documents || []);
      if (p.coverImage) {
        setExistingCoverImage(p.coverImage);
        setCoverPreview(p.coverImage);
      }
      setIsLoading(false);
    }
  }, [projectData]);

  if (workspaceLoading || projectLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0b0b10]">
        <div className="text-center">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
            style={{
              borderColor: workspaceData?.workspace?.color || '#0d9488',
              borderTopColor: 'transparent',
            }}
          />
          <p className="mt-3 text-gray-500 dark:text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  const project = projectData?.project;
  if (!workspace || !project) return null;

  const brandColor = workspace.color || '#0d9488';

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setDocuments([...documents, ...files]);
    e.target.value = '';
  };

  const handleRemoveDocument = (index) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleRemoveExistingDocument = (index) => {
    setExistingDocuments(existingDocuments.filter((_, i) => i !== index));
  };

  const handleCoverImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveCoverImage = () => {
    setCoverImage(null);
    setCoverPreview(null);
    setExistingCoverImage(null);
  };

  const handleRichTextFormat = (format) => {
    const textarea = document.getElementById('detailedDescription');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = detailedDescription.substring(start, end);
    let formattedText = '';

    switch (format) {
      case 'bold':
        formattedText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        formattedText = `*${selectedText || 'italic text'}*`;
        break;
      case 'underline':
        formattedText = `__${selectedText || 'underlined text'}__`;
        break;
      case 'bullet':
        formattedText = selectedText
          ? selectedText.split('\n').map(line => `• ${line}`).join('\n')
          : '• List item';
        break;
      case 'number':
        formattedText = selectedText
          ? selectedText.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n')
          : '1. Numbered item';
        break;
      case 'quote':
        formattedText = selectedText
          ? selectedText.split('\n').map(line => `> ${line}`).join('\n')
          : '> Quote text';
        break;
      default:
        return;
    }

    const newText = detailedDescription.substring(0, start) + formattedText + detailedDescription.substring(end);
    setDetailedDescription(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + formattedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('description', description.trim());
      formData.append('detailedDescription', detailedDescription.trim());
      formData.append('priority', priority);
      formData.append('projectType', projectType);
      formData.append('dailyReportTime', dailyReportTime);
      
      if (links.trim()) {
        formData.append('links', links.trim());
      }
      
      documents.forEach(doc => formData.append('documents', doc));
      
      if (coverImage) {
        formData.append('coverImage', coverImage);
      }

      await updateProject({
        projectId,
        data: formData,
      }).unwrap();
      toast.success('Project updated successfully!');
      navigate(`/my-workspace/${workspaceId}/projects`);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update project');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0b10] flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 sticky top-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 dark:bg-[#0f0f12] md:min-h-screen overflow-y-auto pb-24 md:pb-0">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 md:py-6">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200 dark:border-gray-800/40">
            <button
              onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800/30 rounded-xl transition text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
            >
              <FaArrowLeft />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">Edit Project</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Update your project details</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ── Basic Information ── */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl p-5 border border-gray-200 dark:border-gray-800/60">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <FaInfoCircle className="text-xs" style={{ color: brandColor }} />
                Basic Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">
                    Project Name <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">
                    Short Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                  />
                </div>
              </div>
            </div>

            {/* ── Detailed Description with Rich Text ── */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl p-5 border border-gray-200 dark:border-gray-800/60">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Detailed Description</h2>
              <div className="bg-gray-100 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-800/60 rounded-xl overflow-hidden">
                <RichTextToolbar onFormat={handleRichTextFormat} brandColor={brandColor} />
                <textarea
                  id="detailedDescription"
                  value={detailedDescription}
                  onChange={(e) => setDetailedDescription(e.target.value)}
                  placeholder="Detailed project description with formatting support..."
                  className="w-full px-4 py-3 text-sm focus:outline-none bg-gray-100 dark:bg-[#0b0b10] text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 min-h-[150px] resize-y"
                  rows="6"
                />
                <div className="px-3 py-1.5 bg-gray-200 dark:bg-[#1a1a24] border-t border-gray-300 dark:border-gray-800/60 text-[10px] text-gray-500 dark:text-gray-500">
                  Supports Markdown: **bold**, *italic*, • bullet, 1. numbered, &gt; quotes
                </div>
              </div>
            </div>

            {/* ── Project Settings ── */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl p-5 border border-gray-200 dark:border-gray-800/60">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <FaTag className="text-xs" style={{ color: brandColor }} />
                Project Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Priority</label>
                  <div className="flex gap-2">
                    {['low', 'medium', 'high', 'urgent'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition capitalize ${
                          priority === p
                            ? 'text-white shadow-[0_0_15px_rgba(13,148,136,0.2)]'
                            : 'bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/30'
                        }`}
                        style={priority === p ? { backgroundColor: brandColor } : {}}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5">Project Type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200"
                  >
                    <option value="general">General</option>
                    <option value="software">Software Development</option>
                    <option value="design">Design</option>
                    <option value="social_media">Social Media</option>
                    <option value="marketing">Marketing</option>
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-400 mb-1.5 flex items-center gap-2">
                  <FaClock className="text-xs" style={{ color: brandColor }} />
                  Daily Report Time
                </label>
                <input
                  type="time"
                  value={dailyReportTime}
                  onChange={(e) => setDailyReportTime(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Team members will submit daily reports by this time
                </p>
              </div>
            </div>

            {/* ── Links ── */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl p-5 border border-gray-200 dark:border-gray-800/60">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <FaLink className="text-xs" style={{ color: brandColor }} />
                Important Links
              </h2>
              <textarea
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="Enter links (one per line)&#10;https://example.com&#10;https://another.com"
                className="w-full px-4 py-2.5 bg-white dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0d9488] text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500"
                rows="3"
              />
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Enter each link on a new line</p>
            </div>

            {/* ── Cover Image ── */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl p-5 border border-gray-200 dark:border-gray-800/60">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <FaImage className="text-xs" style={{ color: brandColor }} />
                Cover Image
              </h2>
              <div className="flex flex-wrap items-center gap-4">
                {coverPreview ? (
                  <div className="relative">
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-24 h-24 rounded-xl object-cover border-2 border-gray-300 dark:border-gray-700/60"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveCoverImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                    >
                      <FaTrashAlt className="w-3 h-3" />
                    </button>
                    {existingCoverImage && (
                      <span className="absolute -bottom-6 left-0 text-[10px] text-gray-500 dark:text-gray-500">
                        Existing cover (click to replace)
                      </span>
                    )}
                  </div>
                ) : (
                  <label className="flex items-center gap-3 px-5 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700/60 rounded-xl cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition bg-gray-50 dark:bg-[#0b0b10]">
                    <FaImage className="text-gray-500 dark:text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Upload Cover Image</span>
                    <input
                      type="file"
                      onChange={handleCoverImageChange}
                      className="hidden"
                      accept="image/*"
                    />
                  </label>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-500">PNG, JPG, WebP (max 5MB)</p>
              </div>
              {existingCoverImage && !coverImage && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Current cover image will be kept</p>
              )}
            </div>

            {/* ── Documents ── */}
            <div className="bg-white dark:bg-[#14141a] rounded-2xl p-5 border border-gray-200 dark:border-gray-800/60">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <FaFileAlt className="text-xs" style={{ color: brandColor }} />
                Documents
              </h2>
              {existingDocuments.length > 0 && (
                <div className="mb-3 space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Existing Documents:</p>
                  {existingDocuments.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-[#1a1a24] rounded-lg px-3 py-1.5 border border-gray-200 dark:border-gray-800/40">
                      <span className="text-sm text-gray-800 dark:text-gray-300 truncate max-w-[80%]">{doc.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExistingDocument(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition"
                      >
                        <FaTrashAlt className="text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-[#0b0b10] border border-gray-300 dark:border-gray-700/60 rounded-xl text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-[#0d9488]/20 file:text-[#0d9488] hover:file:bg-[#0d9488]/30"
                accept=".pdf,.doc,.docx,.txt,.zip,.png,.jpg,.jpeg"
              />
              {documents.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">New Documents:</p>
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between bg-white dark:bg-[#0b0b10] rounded-lg px-3 py-1.5 border border-gray-300 dark:border-gray-700/60">
                      <span className="text-sm text-gray-800 dark:text-gray-300 truncate max-w-[80%]">{doc.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition"
                      >
                        <FaTrashAlt className="text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Upload PDFs, documents, images (max 10 files)</p>
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800/40">
              <button
                type="button"
                onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)}
                className="flex-1 py-3 border border-gray-300 dark:border-gray-700/60 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/30 transition text-sm font-medium text-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="flex-1 py-3 text-white rounded-xl transition hover:opacity-90 disabled:opacity-70 text-sm font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: brandColor }}
              >
                {isUpdating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <FaSave className="text-xs" /> Update Project
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <MyWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default MyWorkspaceUpdateProject;