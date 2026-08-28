// hooks/useMediaPicker.js
import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export const useMediaPicker = () => {
  const [files, setFiles] = useState([]);

  const pickMedia = async (options = {}) => {
    const { multiple = false, source = CameraSource.Prompt } = options;

    if (Capacitor.isNativePlatform()) {
      try {
        if (multiple) {
          // Capacitor 5+ supports pickImages
          const result = await Camera.pickImages({
            limit: 10,
          });
          // Convert each result to a File
          const filePromises = result.photos.map(async (photo) => {
            const response = await fetch(photo.webPath);
            const blob = await response.blob();
            return new File([blob], photo.path || 'image.jpg', { type: blob.type });
          });
          const fileList = await Promise.all(filePromises);
          setFiles(fileList);
          return fileList;
        } else {
          const photo = await Camera.getPhoto({
            quality: 90,
            allowEditing: true,
            resultType: CameraResultType.Uri,
            source,
          });
          if (photo.webPath) {
            const response = await fetch(photo.webPath);
            const blob = await response.blob();
            const file = new File([blob], 'profile.jpg', { type: blob.type });
            setFiles([file]);
            return [file];
          }
        }
      } catch (err) {
        if (err.message !== 'User cancelled photos app') {
          console.error('Media picker error:', err);
          throw err;
        }
      }
    } else {
      // Web fallback: trigger file input
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = multiple;
        input.accept = 'image/*';
        input.onchange = (e) => {
          const fileList = Array.from(e.target.files);
          setFiles(fileList);
          resolve(fileList);
        };
        input.click();
      });
    }
  };

  return { files, pickMedia, setFiles };
};