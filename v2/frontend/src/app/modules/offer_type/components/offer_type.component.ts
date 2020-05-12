/* 
   Copyright 2020 Google LLC

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

   https://www.apache.org/licenses/LICENSE-2.0
 
   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { OfferTypeFacade } from '../offer_type.facade';
import { Observable } from 'rxjs';
import { OfferType } from 'app/models/offertype';
import { Config } from 'app/models/config';
import { Router } from '@angular/router';
import { Base } from 'app/models/base';
import { first } from 'rxjs/operators'
import * as UUID from 'uuid/v4'

@Component({
  selector: 'app-base',
  templateUrl: '../views/offer_type.component.html',
  styleUrls: ['../views/offer_type.component.scss'],
  providers: [OfferTypeFacade]
})
export class OfferTypeComponent implements OnInit {
  
  types : Array<string> = ['product', 'asset']
  step : number
  offer_types : Observable<OfferType[]>
  bases : Array<Base>
  offer_type : OfferType
  config : any = {}
  example_time = {}
  fields : Array<string>
  contents : Array<any>
  content : any
  elements : Array<any>
  loaded_fonts : Set<string>
  locked_name = false
  is_video : boolean
  video
  video_url
  video_pos

  constructor(public facade : OfferTypeFacade, private router: Router, private _snackBar: MatSnackBar, private cd: ChangeDetectorRef) {
    this.offer_types = this.facade.offer_types$
    
    this.facade.bases.subscribe(bases => {
      this.bases = bases
    })
  }

  ngOnInit() {
    this.elements = []
    this.step = 1 
    this.video_url = ''
    this.loaded_fonts = new Set()
    this.config = new Config()
    this.offer_type = new OfferType('OfferType', '', [])

    this.facade.update_products()
  }

  move_step(step) {
    this.step = step
  }

  choose_base(base : Base) {

    this.video_url = base.url
    
    if (!this.locked_name)
      this.offer_types.pipe(first()).subscribe(ots => {
        this.offer_type.title += ' ' + (ots.length + 1)
      })
    
    this.offer_type.base = base.title
    this.is_video = base.file.endsWith('.mp4')
    this.example_time = base.products[0]
    this.move_step(3)
  }

  edit_type(offer_type : OfferType) {
    this.offer_type = {...offer_type}
    this.locked_name = true
    this.choose_base(this.bases.filter(b => b.title == offer_type.base)[0])
  }

  copy_type(offer_type : OfferType) {
    this.offer_type = {...offer_type}
    this.move_step(2)
  }

  delete_type(offer_type : OfferType) {

    this._snackBar.open('Confirm ' + offer_type.title + ' deletion?', 'Confirm', {
      duration: 4000
    }).onAction().subscribe(() => {
      this.facade.delete_offer_type(offer_type.title, offer_type.base).then((res) => {
        this._snackBar.open('Deleted (' + res['status'] + ')', 'OK', {
          duration: 2000
        })
      })
    })
  }
  
  public on_image_loaded(img) {

    this.video = img

    var rect = img.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop

    // To calculate elements positions relative
    this.video_pos = {
      x: rect.left, 
      y: rect.top + scrollTop,
      offset_x: img.offsetLeft,
      offset_y: img.offsetTop,
      x_ratio: 1,
      y_ratio: 1
    }

    this.load_elements_on_video()
  }

  public on_video_loaded(video) {
    
    const adjust = video.videoWidth / 800

    const WIDTH = video.videoWidth / adjust 
    const HEIGHT = video.videoHeight / adjust 

    this.video = video

    video.width = WIDTH
    video.height = HEIGHT

    var rect = video.getBoundingClientRect();

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop

    // To calculate elements positions relative
    this.video_pos = {
      x: rect.left, 
      y: rect.top + scrollTop,
      offset_x: video.offsetLeft,
      offset_y: video.offsetTop,
      x_ratio: video.videoWidth/WIDTH,
      y_ratio: video.videoHeight/HEIGHT
    }

    this.load_elements_on_video()
  }

  select_type(type) {

    if (type == 'product')
      this.fields = this.facade.product_headers
    else
      this.fields = ['text', 'image']

    this.contents = []
  }

  select_field(field) {

    if (this.config.type == 'product') {

      this.contents = this.facade.products.map(p => { 
        return {'id': p.id, 'value': p.values[field] } 
      })
    } else {
      this.contents = this.facade.assets.map(a => { return {'id': a.id, 'value': a[field] || ''} })
    }

    this.contents = this.contents.filter(a => a.value != undefined)
  }

  select_example(content) {
    this.config.key = content.id
    this.config.content = content.value
  }

  is_image(content) {
    return content && content.startsWith('http')
  }
  
  private create_element(product) {
    
    const element = {
      id: UUID(),
      x: 0,
      y: 0,
      ...product
    }

    this.elements.push(element)

    return element
  }

  // Bind from view
  create_text(product?) {
    
    const current_product = product ? product : this.config
    const element = this.create_element(current_product)

    element.view_type = 'text'

    // Load font for this text, if not loaded yet
    const font_name = current_product.font.split('.')[0]

    if (!this.loaded_fonts.has(font_name)) {

      const font_content = this.facade.fonts[current_product.font]

      const styles = `
      @font-face {
        font-family: ${font_name};
        src: url(data:font/truetype;charset=utf-8;base64,${btoa(font_content)}) format('truetype');
      }`

      const node = document.createElement('style');
      node.innerHTML = styles;
      document.head.appendChild(node); 

      this.loaded_fonts.add(font_name)
    }

    // Add this font to the element
    element.font_family = font_name

    // Wrap text to break into lines
    element.content = this.wrap_text(
      current_product['content'],
      current_product['width'])
      .join('<br/>')
      
      return element
    }
    
    // Bind from view
    public create_image(product?) {
      
      const current_product = product ? product : this.config
      const element = this.create_element(current_product)
      
      element.view_type = 'image'

      return element
    }
    
    private wrap_text(text, charaters_per_line) {
      
      const words = []
      
      if (charaters_per_line == 0 || text == undefined)
        return [text]
      
      const all_words = text.split(' ')
      let curr_chars = 0
      let last_index = 0
      
      all_words.forEach((word, i) => {
        
        if (curr_chars + word.length >= charaters_per_line) {
          words.push(all_words.slice(last_index, i).join(' '))
          last_index = i
          curr_chars = 0
        }
        
        if (i == all_words.length - 1)
        words.push(all_words.slice(last_index, i+1).join(' '))
        
        curr_chars += word.length
      })
      
      return words
    }

    public drag_start(event) {
      event.dataTransfer.setData("text/plain", event.target.id)
    }
    
    public drag_over(event) {
      event.preventDefault();
      return false;
    }
    
    public drop_event(event) {
      
      const id = event.dataTransfer.getData("text/plain")

      if (!id)
        return

      const x = event.clientX - this.video_pos.x
      const y = event.clientY - this.video_pos.y
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop

      // Element on screen
      const dm = document.getElementById(id)

      // Element saved
      const element = this.elements.filter(e => e.id == id)[0]
    
      element.left = (this.video_pos.offset_x + x - dm.offsetWidth/2) + 'px';
      element.top = (this.video_pos.offset_y + y - dm.offsetHeight/2 + scrollTop) + 'px';

      // Adjust on align
      let align_adjust = 0
      
      if (element.align && element.align == 'left')
        align_adjust = dm.offsetWidth/2

      if (element.align && element.align == 'right')
        align_adjust = -dm.offsetWidth/2

      element.x = ((x - align_adjust) * this.video_pos.x_ratio).toFixed(0)
      element.y = ((y - dm.offsetHeight/2 + scrollTop) * this.video_pos.y_ratio).toFixed(0)
      
      event.preventDefault()
      return false
    }

    load_elements_on_video() {

      // Go to video position
      if (this.example_time && this.video.currentTime != this.example_time['start_time']) {
        this.video.currentTime = this.example_time['start_time']
      }

      // Add all elements on screen
      for(let c of this.offer_type.configs) {

        let element

        // Draw assets
        if (c.type == 'asset') {
          
          const content = this.facade.assets.filter(a => a.id == c.key)[0][c.field]

          if (c.field == 'image')
            element = this.create_image({...c, content})
          else
            element = this.create_text({...c, content})
        } else {

          // Product
          const current_product = this.facade.products.filter(p => p.id == c.key)[0] || this.facade.products[0]
          const content = current_product.values[c.field]

          if (this.is_image(content))
            element = this.create_image({...c, content})
          else
            element = this.create_text({...c, content})
        }

        element.needs_screen_adjust = true
      }

      this.offer_type.configs = []
    }
    
    public delete_element(event) {
      
      event.preventDefault();
      
      const id = event.target.id
      
      // Delete from screen
      this.elements = this.elements.filter(e => e.id != id)
      
      return false;
    }
    
    private add_elements_to_configs() {
      
      for (let e of this.elements) {
        // Add texts
        if (e.view_type == 'text')
          this.offer_type.configs.push(new Config(
            e.key,
            e.type,
            e.field,
            parseInt(e.x),
            parseInt(e.y),
            0,//this.offer_type.start_time,
            0,//this.offer_type.end_time,
            e.font,
            e.color,
            Math.floor(e.size * this.video_pos.x_ratio),
            e.width,
            0,
            e.align,
            e.angle
          ))
        else
      // Add images
        this.offer_type.configs.push(new Config(
          e.key,
          e.type,
          e.field,
          parseInt(e.x),
          parseInt(e.y),
          0,//this.offer_type.start_time,
          0,//this.offer_type.end_time,
          '',
          '',
          0,
          e.width * this.video_pos.x_ratio,
          e.height * this.video_pos.y_ratio,
          e.align,
          e.angle
        ))
      }

      // Delete any other with same title
      this.facade.delete_offer_type(this.offer_type.title, this.offer_type.base)

      // Add it
      this.facade.add_offer_type(this.offer_type)
    }

    finish() {
      this.add_elements_to_configs()
      this.save()
    }
      
    save() {

      this._snackBar.open("Saving...", 'OK', {
        duration: 2000,
      })

      this.facade.save().then(response => {

        const status = response['status']

        if (status == 200)
          window.location.replace('offer_types')
        else
          this._snackBar.open("Error (" + status + ')', 'OK', { duration: 10000 })
      })
    }
  }