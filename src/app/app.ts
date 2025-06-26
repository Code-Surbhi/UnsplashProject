import { Component, OnInit, OnDestroy } from '@angular/core'; // Ensure OnDestroy is imported
import { CommonModule } from '@angular/common';
import { RouterOutlet, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule, HttpClientModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent implements OnInit, OnDestroy { 

  accessToken: string | null = null;

  images: any[] = [];
  currentPage: number = 1;
  currentQuery: string = '';
  isLoading: boolean = false;
  loadingMore: boolean = false; 
  totalPages: number = Infinity;

  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private unsplashAppId: string = '0aiYwSKwVqLwqAa2pCh1mLOYZHpeggvH0nTufFm-V8o'; // Ensure this matches server.js
  private redirectUri: string = 'http://localhost:4200/callback.html';
  private backendUrl: string = 'http://localhost:3000';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef  

  ) {
    console.log("AppComponent constructor.");
  }

  loginDisabled: boolean = false;

  ngOnInit(): void {
    this.accessToken = localStorage.getItem('access_token');
    
    this.canvas = document.getElementById('drawingCanvas') as HTMLCanvasElement;
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    } else {
      console.error("Canvas element not found!");
    }

    if (this.accessToken) {
      console.log("User already logged in with token:", this.accessToken);
    }

    this.route.queryParams.subscribe(params => {
      const code = params['code'];
    
      if (code && !this.accessToken) {
        this.exchangeCodeForToken(code);
      }
    });

    window.addEventListener('storage', this.handleStorageChange.bind(this));
    window.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== 'http://localhost:4200') return;

    const token = event.data.access_token;
    if (token) {
      this.accessToken = token;
      localStorage.setItem('access_token', token);
      console.log("Token received from popup:", token);

      this.cdr.detectChanges();
    }
  });

  window.addEventListener('storage', this.handleStorageChange.bind(this));

  }

  ngOnDestroy(): void {
    window.removeEventListener('storage', this.handleStorageChange.bind(this));
  }

  private handleStorageChange(event: StorageEvent): void {
    if (event.key === 'access_token' && event.newValue && !this.accessToken) {
      console.log("Storage event detected access_token set by another window. Updating main window.");
      this.accessToken = event.newValue;
      
      this.cdr.detectChanges(); 
    }
  }

  private exchangeCodeForToken(code: string): void {
    const tokenUrl = `${this.backendUrl}/callback`;
    this.http.post<{ accessToken: string }>(tokenUrl, { code: code }).subscribe(
      response => {
        this.accessToken = response.accessToken;
        localStorage.setItem('access_token', this.accessToken);
        console.log("Access token received and stored:", this.accessToken);

        if (window.opener) {
            console.log("Popup window successfully exchanged code. Closing popup.");
            window.close(); 
        } else {
            this.router.navigate([], {
                queryParams: { 'code': null },
                queryParamsHandling: 'merge'
            });
        }
      },
      error => {
        console.error("Error exchanging code for token:", error);
        this.accessToken = null;
        localStorage.removeItem('access_token');
        if (!window.opener) {
            this.router.navigate(['/']);
        }
      }
    );
  }

  loginWithUnsplash(): void {
  if (this.loginDisabled) {
    console.log("Login button temporarily disabled to prevent spam clicks.");
    return;
  }

  this.loginDisabled = true; 

  setTimeout(() => {
    this.loginDisabled = false; 
  }, 3000);

  const authorizeUrl = `https://unsplash.com/oauth/authorize?client_id=${this.unsplashAppId}&redirect_uri=${this.redirectUri}&response_type=code&scope=public`;

  window.open(authorizeUrl, '_blank', 'width=500,height=600,top=100,left=100');
}


onSearchInputChange(event: Event): void {
  const inputElement = event.target as HTMLInputElement;
  this.currentQuery = inputElement.value; 
}


  performSearch(loadMore: boolean = false, query: string = this.currentQuery): void {

    if (!this.accessToken) {
    console.warn("Cannot perform search: Not logged in.");
    return;
  }

  if (!query.trim()) {
    this.images = [];
    this.totalPages = Infinity;
    this.currentPage = 1;
    return;
  }

  if (this.isLoading || this.loadingMore) {
    console.log("Search already in progress, ignoring request.");
    return;
  }

  if (loadMore && this.currentPage >= this.totalPages) {
    console.log("No more pages to load.");
    return;
  }

  this.isLoading = !loadMore;
  this.loadingMore = loadMore;

  const pageToLoad = loadMore ? this.currentPage + 1 : 1;
  const searchUrl = `${this.backendUrl}/search?query=${encodeURIComponent(query)}&page=${pageToLoad}`;

  this.http.get<any>(searchUrl, {
    headers: { 'Authorization': `Bearer ${this.accessToken}` }
  }).subscribe(
    response => {
      this.isLoading = false;
      this.loadingMore = false;

      if (response && Array.isArray(response.results)) {
        if (!loadMore) {
          this.images = []; 
        }

        this.images = [...this.images, ...response.results];
        this.currentPage = pageToLoad;
        this.totalPages = response.total_pages || 1;
        this.cdr.detectChanges();
        console.log(`Found ${response.results.length} images on page ${this.currentPage}.`);
      } else {        
        this.images = [];
        this.totalPages = 1;
        console.warn("Unexpected API response:", response);
      }
    },
    error => {
      this.isLoading = false;
      this.loadingMore = false;
      this.images = [];

      console.error("Search error:", error);

      if (error.status === 403) {
        alert("Rate limit exceeded. Try again later.");
      } else if (error.status === 401) {
        alert("Session expired. Please log in again.");
        this.accessToken = null;
        localStorage.removeItem('access_token');
        if (!window.opener) this.router.navigate(['/']);
      } else {
        alert("Failed to load images. Please try again.");
      }
    }
  );
}


onScroll(): void {
  const imageGrid = document.getElementById('imageGrid');
  if (imageGrid) {
    const scrollThreshold = 150;
    const atBottom = imageGrid.scrollTop + imageGrid.clientHeight >= imageGrid.scrollHeight - scrollThreshold;

    if (atBottom && !this.isLoading && !this.loadingMore && this.currentPage < this.totalPages) {
      console.log("Scrolling near bottom, attempting to load next page via infinite scroll...");
      this.performSearch(true, this.currentQuery);
    }
  }
}

drawImageOnCanvas(imageUrl: string): void {
  if (!this.canvas || !this.ctx) {
    console.error("Canvas not initialized.");
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous'; 

  img.onload = () => {
    this.ctx!.clearRect(0, 0, this.canvas!.width, this.canvas!.height);

    const scale = Math.min(this.canvas!.width / img.width, this.canvas!.height / img.height, 1);

    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;

    const x = (this.canvas!.width - drawWidth) / 2;
    const y = (this.canvas!.height - drawHeight) / 2;

    this.ctx!.drawImage(img, x, y, drawWidth, drawHeight);
    this.ctx!.beginPath();
  };

  img.onerror = (err) => {
    console.error("Failed to load image onto canvas:", err);
  };

  img.src = imageUrl;
}

onEnterSearch(): void {
  const trimmedQuery = this.currentQuery.trim();
  if (trimmedQuery) {
    this.performSearch(false, trimmedQuery);
  }
}


}