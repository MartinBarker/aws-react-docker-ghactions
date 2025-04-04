import React, { useState } from 'react';
import styles from './RenderOptions.module.css';

function RenderOptions({ 
  imageFiles, 
  audioFiles, 
  audioRowSelection, 
  imageRowSelection, 
  onRender,
  resolution,
  setResolution,
  renderButtonEnabled // Add this prop
}) {
  // Add resolution options
  const resolutionOptions = [
    ['7680x4320', '3840x2160', '2560x1440', '1920x1080', '1280x720', '854x480', '640x360'],
    ['4320x7680', '2160x3840', '1440x2560', '1080x1920', '720x1280', '480x854', '360x640']
  ];

  const [outputFilename, setOutputFilename] = useState('');
  const [outputFormat, setOutputFormat] = useState('mp4');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedResolution, setSelectedResolution] = useState('1920x1080');
  const [videoWidth, setVideoWidth] = useState('1920');
  const [videoHeight, setVideoHeight] = useState('1080');
  const [alwaysUniqueFilenames, setAlwaysUniqueFilenames] = useState(false);

  const handleOutputFilenameChange = (e) => setOutputFilename(e.target.value);
  const handleImageSelectionChange = (e) => setSelectedImageIndex(Number(e.target.value));
  const handleResolutionChange = (e) => {
    setSelectedResolution(e.target.value);
    setResolution(e.target.value);
  };
  const handleVideoWidthChange = (e) => setVideoWidth(e.target.value);
  const handleVideoHeightChange = (e) => setVideoHeight(e.target.value);

  const generateOutputFilenameOptions = () => ['output.mp4', 'video.mp4', 'rendered.mp4'];

  const handleRender = () => {
    const options = {
      outputFilename,
      outputFormat,
      resolution: selectedResolution,
      width: videoWidth,
      height: videoHeight,
      alwaysUniqueFilenames
    };
    onRender(options);
  };

  return (
<div className={styles.renderOptionsSection}>
  <h2 className={styles.renderOptionsTitle}>Render Options</h2>
  <div className={styles.renderOptionsGrid}>
    {/* Output Filename */}
    <div className={styles.renderOptionGroup}>
      <label htmlFor="outputFilename" className={styles.renderOptionLabel}>
        Output Filename
      </label>
      <div className={styles.editableDropdown}>
        <input
          type="text"
          id="outputFilename"
          value={outputFilename}
          onChange={handleOutputFilenameChange}
          placeholder="Enter filename (letters, numbers, spaces, - and _ only)"
          className={styles.renderOptionInput}
          maxLength={255}
        />
        <select
          id="outputFilenameOptions"
          value={outputFilename}
          onChange={(e) => setOutputFilename(e.target.value)}
          className={styles.renderOptionSelect}
        >
          {generateOutputFilenameOptions().map((option, index) => (
            <option key={index} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>

    {/* Output Format */}
    <div className={styles.renderOptionGroup}>
      <label htmlFor="outputFormat" className={styles.renderOptionLabel}>
        Output Format
      </label>
      <select
        id="outputFormat"
        value={outputFormat}
        onChange={(e) => setOutputFormat(e.target.value)}
        className={styles.renderOptionSelect}
      >
        <option value="mp4">MP4</option>
        <option value="mkv">MKV</option>
      </select>
    </div>

    {/* Resolution */}
    <div className={styles.renderOptionGroup}>
      <label htmlFor="resolution" className={styles.renderOptionLabel}>
        Resolution
      </label>
      <div className={styles.resolutionBox}>
        <select
          id="imageSelection"
          value={selectedImageIndex}
          onChange={handleImageSelectionChange}
          className={styles.renderOptionSelect}
        >
          {imageFiles.map((image, index) => (
            <option key={index} value={index}>
              {image.filename}
            </option>
          ))}
        </select>
        <select
          id="resolutionSelection"
          value={selectedResolution}
          onChange={handleResolutionChange}
          className={styles.renderOptionSelect}
        >
          {resolutionOptions[selectedImageIndex]?.map((resolution, index) => (
            <option key={index} value={resolution}>
              {resolution}
            </option>
          ))}
        </select>
      </div>
    </div>

    {/* Video Width */}
    <div className={styles.renderOptionGroup}>
      <label htmlFor="videoWidth" className={styles.renderOptionLabel}>
        Width (px)
      </label>
      <input
        type="text"
        id="videoWidth"
        value={videoWidth}
        onChange={handleVideoWidthChange}
        className={`${styles.renderOptionInput} ${styles.widthInput}`}
        placeholder="Enter width (1-7680)"
        maxLength={4}
      />
    </div>

    {/* Video Height */}
    <div className={styles.renderOptionGroup}>
      <label htmlFor="videoHeight" className={styles.renderOptionLabel}>
        Height (px)
      </label>
      <input
        type="text"
        id="videoHeight"
        value={videoHeight}
        onChange={handleVideoHeightChange}
        className={`${styles.renderOptionInput} ${styles.heightInput}`}
        placeholder="Enter height (1-4320)"
        maxLength={4}
      />
    </div>

    {/* Always Unique Filenames */}
    <div className={styles.renderOptionGroup}>
      <label className={styles.renderOptionCheckboxLabel}>
        <input
          type="checkbox"
          id="alwaysUniqueFilenames"
          checked={alwaysUniqueFilenames}
          onChange={(e) => setAlwaysUniqueFilenames(e.target.checked)}
          className={styles.renderOptionCheckbox}
        />
        Always Unique Filenames
      </label>
    </div>
  </div>

  {/* Render Button */}
  <button
    className={styles.renderButton}
    onClick={handleRender}
    disabled={!renderButtonEnabled}
  >
    Render
  </button>
</div>
  );
}

export default RenderOptions;
