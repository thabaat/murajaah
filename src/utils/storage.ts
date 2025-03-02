import * as FileSystem from 'expo-file-system';

// Base directory for app data
const APP_DIRECTORY = 'murajaah';

// Get base cache directory
export const getCacheDirectory = async (): Promise<string> => {
  const baseDir = `${FileSystem.cacheDirectory}${APP_DIRECTORY}`;
  await ensureDirectoryExists(baseDir);
  return baseDir;
};

// Get audio cache directory
export const getAudioCacheDirectory = async (): Promise<string> => {
  const baseDir = await getCacheDirectory();
  const audioDir = `${baseDir}/audio`;
  await ensureDirectoryExists(audioDir);
  return audioDir;
};

// Ensure directory exists
export const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }
};

// Get file size in human-readable format
export const getFileSizeString = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
};

// Calculate total cache size
export const calculateCacheSize = async (): Promise<number> => {
  try {
    const baseDir = await getCacheDirectory();
    return await calculateDirectorySize(baseDir);
  } catch (error) {
    console.error('Error calculating cache size:', error);
    return 0;
  }
};

// Calculate directory size recursively
const calculateDirectorySize = async (dirPath: string): Promise<number> => {
  try {
    const dirContents = await FileSystem.readDirectoryAsync(dirPath);
    let totalSize = 0;
    
    for (const item of dirContents) {
      const itemPath = `${dirPath}/${item}`;
      const itemInfo = await FileSystem.getInfoAsync(itemPath);
      
      if (itemInfo.exists) {
        if (itemInfo.isDirectory) {
          totalSize += await calculateDirectorySize(itemPath);
        } else {
          totalSize += itemInfo.size || 0;
        }
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error(`Error calculating size for directory ${dirPath}:`, error);
    return 0;
  }
};

// Clear all cache
export const clearCache = async (): Promise<void> => {
  try {
    const baseDir = await getCacheDirectory();
    await FileSystem.deleteAsync(baseDir, { idempotent: true });
    await ensureDirectoryExists(baseDir);
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
};

// Clear specific directory within cache
export const clearDirectory = async (dirName: string): Promise<void> => {
  try {
    const baseDir = await getCacheDirectory();
    const dirPath = `${baseDir}/${dirName}`;
    
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(dirPath, { idempotent: true });
      await ensureDirectoryExists(dirPath);
    }
  } catch (error) {
    console.error(`Error clearing directory ${dirName}:`, error);
    throw error;
  }
};