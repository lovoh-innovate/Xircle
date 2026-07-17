// src/workspaceScreens/MyWorkspaceCreateProject.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useGetWorkspaceQuery } from '../slices/workspaceApiSlice';
import { useCreateProjectMutation } from '../slices/projectApiSlice';
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
  FaCalendarAlt,
  FaClock,
  FaTag,
  FaImage,
  FaListUl,
  FaListOl,
  FaBold,
  FaItalic,
  FaUnderline,
  FaQuoteRight,
} from 'react-icons/fa';
import { toast } from 'react-toastify';

// ─── Rich Text Toolbar ──────────────────────────────────────────────────
const RichTextToolbar = ({ onFormat }) => {
  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 bg-gray-50 border-b border-gray-200 rounded-t-xl flex-wrap">
      <button
        type="button"
        onClick={() => onFormat('bold')}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs font-bold"
        title="Bold"
      >
        <FaBold className="text-xs" />
      </button>
      <button
        type="button"
        onClick={() => onFormat('italic')}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs italic"
        title="Italic"
      >
        <FaItalic className="text-xs" />
      </button>
      <button
        type="button"
        onClick={() => onFormat('underline')}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs underline"
        title="Underline"
      >
        <FaUnderline className="text-xs" />
      </button>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={() => onFormat('bullet')}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs"
        title="Bullet List"
      >
        <FaListUl className="text-xs" />
      </button>
      <button
        type="button"
        onClick={() => onFormat('number')}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs"
        title="Numbered List"
      >
        <FaListOl className="text-xs" />
      </button>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <button
        type="button"
        onClick={() => onFormat('quote')}
        className="p-1.5 hover:bg-gray-200 rounded text-gray-600 text-xs"
        title="Quote"
      >
        <FaQuoteRight className="text-xs" />
      </button>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────

const MyWorkspaceCreateProject = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { userInfo } = useSelector((state) => state.auth);

  const { data: workspaceData, isLoading } = useGetWorkspaceQuery(workspaceId);
  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();

  // ── Form state ──
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [detailedDescription, setDetailedDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [projectType, setProjectType] = useState('general');
  const [dailyReportTime, setDailyReportTime] = useState('17:00');
  const [links, setLinks] = useState('');
  const [documents, setDocuments] = useState([]);
  const [coverImage, setCoverImage] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: workspaceData?.workspace?.color || '#4F46E5', borderTopColor: 'transparent' }} />
          <p className="mt-3 text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  const workspace = workspaceData?.workspace;
  if (!workspace) return null;

  const brandColor = workspace.color || '#4F46E5';
  const isOwner = workspace.owner?._id === userInfo?._id || workspace.owner === userInfo?._id;

  if (!isOwner) {
    navigate(`/my-workspace/${workspaceId}/projects`);
    return null;
  }

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setDocuments([...documents, ...files]);
    e.target.value = '';
  };

  const handleRemoveDocument = (index) => {
    setDocuments(documents.filter((_, i) => i !== index));
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
      
      // ✅ Links as a simple string
      if (links.trim()) {
        formData.append('links', links.trim());
      }
      
      documents.forEach(doc => formData.append('documents', doc));
      
      if (coverImage) {
        formData.append('coverImage', coverImage);
      }

      console.log('📝 Creating project with data:', {
        workspaceId,
        name: name.trim(),
        priority,
        projectType,
        dailyReportTime,
        links: links.trim() || 'none',
        documentsCount: documents.length,
        hasCoverImage: !!coverImage,
      });

      await createProject({
        workspaceId,
        data: formData,
      }).unwrap();
      
      toast.success('Project created successfully!');
      navigate(`/my-workspace/${workspaceId}/projects`);
    } catch (err) {
      console.error('❌ Create project error:', err);
      toast.error(err?.data?.message || 'Failed to create project');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* ── Left Sidebar ── */}
      <div className="hidden md:block md:w-64 md:min-h-screen md:flex-shrink-0 sticky top-0">
        <MyWorkspaceSidebar workspace={workspace} chats={[]} />
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 bg-white md:min-h-screen overflow-y-auto pb-24 md:pb-0">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-4 md:py-6">
          
          {/* ── Header ── */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
            <button
              onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)}
              className="p-2 hover:bg-gray-100 rounded-xl transition"
            >
              <FaArrowLeft className="text-gray-500" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Create Project</h1>
              <p className="text-sm text-gray-500">Set up a new project for your workspace</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ── Basic Information ── */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FaInfoCircle className="text-xs" style={{ color: brandColor }} />
                Basic Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Website Redesign"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                    style={{ '--tw-ring-color': brandColor }}
                    onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Short Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description of the project"
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                    style={{ '--tw-ring-color': brandColor }}
                    onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                  />
                </div>
              </div>
            </div>

            {/* ── Detailed Description with Rich Text ── */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Detailed Description</h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <RichTextToolbar onFormat={handleRichTextFormat} />
                <textarea
                  id="detailedDescription"
                  value={detailedDescription}
                  onChange={(e) => setDetailedDescription(e.target.value)}
                  placeholder="Detailed project description with formatting support...
You can use:
• Bullet points
• Numbered lists
**Bold text**
*Italic text*
> Quotes"
                  className="w-full px-4 py-3 text-sm focus:outline-none min-h-[150px] resize-y"
                  rows="6"
                />
                <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400">
                  Supports Markdown: **bold**, *italic*, • bullet, 1. numbered, &gt; quotes
                </div>
              </div>
            </div>

            {/* ── Project Settings ── */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FaTag className="text-xs" style={{ color: brandColor }} />
                Project Settings
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <div className="flex gap-2">
                    {['low', 'medium', 'high', 'urgent'].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition capitalize ${
                          priority === p
                            ? 'text-white'
                            : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                        style={priority === p ? { backgroundColor: brandColor } : {}}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Project Type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                    style={{ '--tw-ring-color': brandColor }}
                    onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                  <FaClock className="text-xs" style={{ color: brandColor }} />
                  Daily Report Time
                </label>
                <input
                  type="time"
                  value={dailyReportTime}
                  onChange={(e) => setDailyReportTime(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                  style={{ '--tw-ring-color': brandColor }}
                  onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Team members will submit daily reports by this time
                </p>
              </div>
            </div>

            {/* ── Links ── */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FaLink className="text-xs" style={{ color: brandColor }} />
                Important Links
              </h2>
              <textarea
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="Enter links (one per line)&#10;https://example.com&#10;https://another.com"
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                style={{ '--tw-ring-color': brandColor }}
                onFocus={(e) => e.target.style.setProperty('--tw-ring-color', brandColor)}
                rows="3"
              />
              <p className="text-xs text-gray-400 mt-1">Enter each link on a new line</p>
            </div>

            {/* ── Cover Image ── */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FaImage className="text-xs" style={{ color: brandColor }} />
                Cover Image
              </h2>
              <div className="flex items-center gap-4">
                {coverPreview ? (
                  <div className="relative">
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-24 h-24 rounded-xl object-cover border-2 border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveCoverImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                    >
                      <FaTrashAlt className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 px-5 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-gray-400 transition bg-white">
                    <FaImage className="text-gray-400" />
                    <span className="text-sm text-gray-500">Upload Cover Image</span>
                    <input
                      type="file"
                      onChange={handleCoverImageChange}
                      className="hidden"
                      accept="image/*"
                    />
                  </label>
                )}
                <p className="text-xs text-gray-400">PNG, JPG, WebP (max 5MB)</p>
              </div>
            </div>

            {/* ── Documents ── */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FaFileAlt className="text-xs" style={{ color: brandColor }} />
                Documents
              </h2>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                accept=".pdf,.doc,.docx,.txt,.zip,.png,.jpg,.jpeg"
              />
              {documents.length > 0 && (
                <div className="mt-2 space-y-1">
                  {documents.map((doc, index) => (
                    <div key={index} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 border border-gray-200">
                      <span className="text-sm text-gray-600 truncate max-w-[80%]">{doc.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(index)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <FaTrashAlt className="text-xs" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-1">Upload PDFs, documents, images (max 10 files)</p>
            </div>

            {/* ── Actions ── */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate(`/my-workspace/${workspaceId}/projects`)}
                className="flex-1 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-sm font-medium text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="flex-1 py-3 text-white rounded-xl transition hover:opacity-90 disabled:opacity-70 text-sm font-medium flex items-center justify-center gap-2"
                style={{ backgroundColor: brandColor }}
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <FaSave className="text-xs" /> Create Project
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Bottom Navigation ── */}
      <MyWorkspaceBottombar workspace={workspace} />
    </div>
  );
};

export default MyWorkspaceCreateProject;