import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional
import yt_dlp
import assemblyai as aai

from src.document_processing.doc_processor import DocumentChunk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class YouTubeTranscriber:
    def __init__(self, assemblyai_api_key: str):
        self.assemblyai_api_key = assemblyai_api_key
        self.temp_dir = Path(tempfile.gettempdir()) / "youtube_transcriber"
        self.temp_dir.mkdir(exist_ok=True)
        
        aai.settings.api_key = assemblyai_api_key
        
        logger.info("YouTubeTranscriber initialized")
    
    def extract_video_id(self, url: str) -> Optional[str]:
        if "v=" in url:
            video_id = url.split("v=")[1].split("&")[0]
        elif "youtu.be/" in url:
            video_id = url.split("youtu.be/")[1].split("?")[0]
        else:
            video_id = None
        return video_id
    
    def download_audio(self, url: str) -> str:
        video_id = self.extract_video_id(url)
        if not video_id:
            raise ValueError("Could not extract video ID from URL")

        existing = list(self.temp_dir.glob(f"{video_id}.mp3"))
        if existing:
            logger.info(f"Audio already exists: {existing[0]}")
            return str(existing[0])

        logger.info(f"Downloading audio from: {url}")

        cookies_path = Path(__file__).parents[2] / "cookies" / "cookies.txt"

        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(self.temp_dir / '%(id)s.%(ext)s'),
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
            }],
            'quiet': True,
            'no_warnings': True,
        }

        ffmpeg_path = shutil.which('ffmpeg')
        if ffmpeg_path:
            ydl_opts['ffmpeg_location'] = str(Path(ffmpeg_path).parent)
            logger.info(f"Using FFmpeg at: {ffmpeg_path}")
        else:
            logger.warning("FFmpeg not found on PATH — audio conversion may fail")

        if cookies_path.exists():
            ydl_opts['cookiefile'] = str(cookies_path)
            logger.info(f"Using cookies file: {cookies_path}")
        else:
            logger.warning(f"No cookies file found at {cookies_path} — YouTube bot check may fail")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            error_code = ydl.download([url])
            if error_code != 0:
                raise Exception(f"yt-dlp download failed with error code: {error_code}")

        downloaded = list(self.temp_dir.glob(f"{video_id}.mp3")) or list(self.temp_dir.glob(f"{video_id}.*"))
        if not downloaded:
            raise FileNotFoundError(f"Downloaded audio file not found for video: {video_id}")

        logger.info(f"Audio downloaded successfully: {downloaded[0]}")
        return str(downloaded[0])
    
    def transcribe_youtube_video(
        self,
        url: str,
        cleanup_audio: bool = True
    ) -> List[DocumentChunk]:
        try:
            audio_path = self.download_audio(url)
            
            config = aai.TranscriptionConfig(
                speaker_labels=True,
                punctuate=True
            )
            
            logger.info("Starting transcription with speaker diarization...")
            transcriber = aai.Transcriber(config=config)
            transcript = transcriber.transcribe(audio_path)
            
            if transcript.status == aai.TranscriptStatus.error:
                raise Exception(f"Transcription failed: {transcript.error}")
            
            chunks = []
            video_id = self.extract_video_id(url)
            for i, utterance in enumerate(transcript.utterances):
                chunk = DocumentChunk(
                    content=f"Speaker {utterance.speaker}: {utterance.text}",
                    source_file=f"YouTube Video {video_id}",
                    source_type="youtube",
                    page_number=None,
                    chunk_index=i,
                    start_char=utterance.start,
                    end_char=utterance.end,
                    metadata={
                        'speaker': utterance.speaker,
                        'start_time': utterance.start,
                        'end_time': utterance.end,
                        'confidence': getattr(utterance, 'confidence', None),
                        'video_url': url,
                        'video_id': video_id
                    }
                )
                chunks.append(chunk)
            
            logger.info(f"Transcription completed: {len(chunks)} utterances")
            
            if cleanup_audio and os.path.exists(audio_path):
                os.unlink(audio_path)
                logger.info("Audio file cleaned up")
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error transcribing YouTube video: {str(e)}")
            raise
    
    def cleanup_temp_files(self):
        try:
            if self.temp_dir.exists():
                for file in self.temp_dir.glob("*.m4a"):
                    file.unlink()
                logger.info("Temporary files cleaned up")
        except Exception as e:
            logger.warning(f"Could not clean up temp files: {e}")


if __name__ == "__main__":
    import os
    
    api_key = os.getenv("ASSEMBLYAI_API_KEY")
    if not api_key:
        print("Please set ASSEMBLYAI_API_KEY environment variable")
        exit(1)
    
    transcriber = YouTubeTranscriber(api_key)
    
    try:
        test_url = "https://www.youtube.com/watch?v=D26sUZ6DHNQ"
        chunks = transcriber.transcribe_youtube_video(test_url)
        
        print(f"Transcribed {len(chunks)} utterances:")
        for chunk in chunks[:5]:
            print(f"  {chunk.content}")
        
    except Exception as e:
        print(f"Error: {e}")