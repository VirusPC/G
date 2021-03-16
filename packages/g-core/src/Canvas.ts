import { Entity, System, World } from '@antv/g-ecs';
import { Container, interfaces } from 'inversify';
import { createRootContainer } from './inversify.config';
import { Transform as CTransform } from './components/Transform';
import { Hierarchy as CHierarchy } from './components/Hierarchy';
import { Geometry as CGeometry } from './components/Geometry';
import { Material as CMaterial } from './components/Material';
import { Renderable as CRenderable } from './components/Renderable';
import { Cullable as CCullable } from './components/Cullable';
import { Sortable as CSortable } from './components/Sortable';
import { Visible as CVisible } from './components/Visible';
import { Animator as CAnimator } from './components/Animator';
import { CanvasConfig, Context as SContext, ContextService } from './systems/Context';
import { SceneGraph as SSceneGraph } from './systems/SceneGraph';
import { Timeline as STimeline } from './systems/Timeline';
import { Renderer as SRenderer } from './systems/Renderer';
import { Culling as SCulling } from './systems/Culling';
import { AABB as SAABB } from './systems/AABB';
import { CanvasCfg, GroupCfg, IShape, ShapeCfg } from './types';
import { Shape } from './Shape';
import { cleanExistedCanvas } from './utils/canvas';
import { Group, GroupOrShape, GroupRegistry } from './Group';

export class Canvas {
  protected container: Container;
  protected world: World;
  private frameId: number;
  private frameCallback: Function;

  constructor(private config: CanvasCfg) {
    cleanExistedCanvas(config.container, this);
    this.container = createRootContainer();
    this.init();
    this.run();
  }

  protected loadModule() {
    throw new Error('method not implemented');
  }

  public onFrame(callback: Function) {
    this.frameCallback = callback;
  }

  public destroy() {
    this.world.destroy();
    if (this.frameId) {
      window.cancelAnimationFrame(this.frameId);
    }
  }

  public changeSize(width: number, height: number) {
    const contextService = this.container.get<ContextService<unknown>>(ContextService);
    if (contextService) {
      contextService.resize(width, height);
    }
  }

  public addShape(cfg: ShapeCfg): IShape;
  public addShape(type: string, cfg: ShapeCfg): IShape;
  public addShape(type: string | ShapeCfg, cfg?: ShapeCfg): IShape {
    let config: ShapeCfg;
    let shapeType: string;
    if (typeof type !== 'string') {
      config = type;
      // @ts-ignore
      shapeType = cfg.type || '';
    } else {
      config = cfg!;
      shapeType = type;
    }

    // TODO: 增加更新能力，通过 name 判断如果已经存在则更新，否则新建
    // if () {

    // }

    // create entity with shape's name
    const entity = this.world.createEntity(config.name || '');
    const shape = this.container.get(Shape);
    shape.init(this.container, this.world, entity, shapeType, {
      zIndex: 0,
      visible: true,
      capture: true,
      ...config,
    });

    this.container.bind(GroupOrShape).toConstantValue(shape).whenTargetNamed(entity.getName());
    return shape;
  }

  public addGroup(config: GroupCfg = {}) {
    const entity = this.world.createEntity(config.name || '');
    const group = this.container.get(Group);
    group.init(this.container, this.world, entity, '', {
      zIndex: 0,
      visible: true,
      capture: true,
      ...config,
    });

    this.container.bind(GroupOrShape).toConstantValue(group).whenTargetNamed(entity.getName());
    return group;
  }

  private init() {
    this.container.bind(CanvasConfig).toConstantValue(this.config);
    this.container.bind<interfaces.Factory<Group>>(GroupRegistry).toFactory<Group>((context: interfaces.Context) => {
      return (entityName: string) => {
        return context.container.getNamed(GroupOrShape, entityName);
      };
    });
    this.container.bind(Group).toSelf();
    this.container.bind(Shape).toSelf();

    this.world = this.container.get(World);

    /**
     * register components
     */
    this.world
      .registerComponent(CTransform)
      .registerComponent(CHierarchy)
      .registerComponent(CSortable)
      .registerComponent(CVisible)
      .registerComponent(CCullable)
      .registerComponent(CGeometry)
      .registerComponent(CMaterial)
      .registerComponent(CAnimator)
      .registerComponent(CRenderable);

    this.loadModule();

    /**
     * register systems
     */
    this.world
      .registerSystem(SContext)
      .registerSystem(STimeline)
      .registerSystem(SAABB)
      .registerSystem(SCulling)
      .registerSystem(SSceneGraph)
      .registerSystem(SRenderer);
  }

  private run() {
    let lastTime = performance.now();
    const tick = async () => {
      if (this.frameCallback) {
        this.frameCallback();
      }
      const time = performance.now();
      const delta = time - lastTime;
      // run all the systems
      await this.world.execute(delta, time);
      lastTime = time;
      this.frameId = requestAnimationFrame(tick);
    };
    tick();
  }
}
